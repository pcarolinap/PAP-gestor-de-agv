/**
 * ANDA LÁ — Autonomous AGV Physics & Waypoint Navigation Engine
 * 
 * Este módulo é o motor de física e navegação autónoma do veículo guiado (AGV).
 * Ele simula a movimentação vetorial do robô entre pontos de referência (waypoints),
 * a taxa de descarga/recarga da bateria, o consumo elétrico dos motores e as
 * transições do ciclo de vida das tarefas (Aguardando -> Em preparação -> Em movimento -> Concluída).
 */

import { FACTORY_CONNECTIONS, store } from './store.js';

class AGVSimulator {
  constructor() {
    this.animationFrame = null;
    this.currentTask = null;
    this.currentRoute = null;
    this.waypoints = [];
    this.waypointIndex = 0;
    this.isPaused = false;
    this.emergencyStopActive = false;
    this.emergencyResumeStatus = null;
    this.taskPreparationReady = false;
    this.taskPreparationStartCode = null;
    this.routePreparationReady = false;
    this.routePreparationStartCode = null;
    this.chargingStopped = false;
    this.chargingInterrupted = false;
    this.chargingStationExited = false;
    
    // Multiplicador de velocidade em píxeis por segundo para renderização suave
    this.speedMultiplier = 2.5;
    this.lastTick = performance.now();

    // Mapeamento rápido de coordenadas X, Y para cada zona industrial da fábrica
    this.zoneMap = {};
    store.state.zones.forEach(z => {
      this.zoneMap[z.code] = { x: z.x, y: z.y };
    });

    const tasks = store.getTasks();
    const activeTask = tasks.find(
      task => task.id === store.state.agv.currentTaskId && task.status === 'em_movimento'
    ) || tasks.find(task => task.status === 'em_movimento');
    if (activeTask && ['moving', 'charging', 'prep'].includes(store.state.agv.status)) {
      const route = this.buildWaypoints(
        [activeTask.destination],
        this.getClosestZoneCode(store.state.agv.x, store.state.agv.y)
      );
      if (route) {
        this.currentTask = activeTask;
        this.waypoints = route;
        this.waypointIndex = 0;
        store.updateAGV({
          status: 'moving',
          currentTaskId: activeTask.id,
          carriedBoxId: activeTask.boxId
        });
        store.addLog('warning', `Retomada a navegação da tarefa ${activeTask.id} após recarregar a aplicação.`);
      } else {
        store.updateTaskStatus(activeTask.id, 'erro');
        store.updateAGV({ status: 'error', currentTaskId: null, speed: 0.0 });
        store.addLog('error', `Não foi possível retomar a tarefa ${activeTask.id}: destino inválido.`);
      }
    }
  }

  /**
   * Inicia o ciclo de animação contínuo (loop de física) utilizando requestAnimationFrame.
   */
  start() {
    if (!this.animationFrame) {
      this.lastTick = performance.now();
      this.loop = this.loop.bind(this);
      this.animationFrame = requestAnimationFrame(this.loop);
    }
  }

  stop() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  getZoneCoordinates(zoneCode) {
    const zone = this.zoneMap[zoneCode];
    if (!zone || !Number.isFinite(zone.x) || !Number.isFinite(zone.y)) {
      return null;
    }
    return zone;
  }

  getClosestZoneCode(x, y) {
    let closestCode = null;
    let closestDistance = Infinity;

    Object.entries(this.zoneMap).forEach(([code, zone]) => {
      const distance = Math.hypot(x - zone.x, y - zone.y);
      if (distance < closestDistance) {
        closestCode = code;
        closestDistance = distance;
      }
    });

    return closestCode;
  }

  getShortestPath(startCode, destinationCode) {
    if (!this.zoneMap[startCode] || !this.zoneMap[destinationCode]) return null;

    const distances = new Map(Object.keys(this.zoneMap).map(code => [code, Infinity]));
    const previous = new Map();
    const remaining = new Set(distances.keys());
    distances.set(startCode, 0);

    while (remaining.size > 0) {
      let current = null;
      remaining.forEach(code => {
        if (current === null || distances.get(code) < distances.get(current)) {
          current = code;
        }
      });

      if (current === null || distances.get(current) === Infinity) break;
      if (current === destinationCode) {
        const path = [current];
        while (previous.has(current)) {
          current = previous.get(current);
          path.unshift(current);
        }
        return path;
      }

      remaining.delete(current);
      FACTORY_CONNECTIONS.forEach(([fromCode, toCode]) => {
        const neighbor = fromCode === current
          ? toCode
          : toCode === current ? fromCode : null;
        if (!neighbor || !remaining.has(neighbor)) return;

        const from = this.zoneMap[current];
        const to = this.zoneMap[neighbor];
        const distance = distances.get(current) + Math.hypot(to.x - from.x, to.y - from.y);
        if (distance < distances.get(neighbor)) {
          distances.set(neighbor, distance);
          previous.set(neighbor, current);
        }
      });
    }

    return null;
  }

  buildWaypoints(stopCodes, startCode) {
    let currentCode = startCode;
    const pathCodes = [];

    for (const stopCode of stopCodes) {
      const path = this.getShortestPath(currentCode, stopCode);
      if (!path) return null;
      pathCodes.push(...(pathCodes.length > 0 ? path.slice(1) : path));
      currentCode = stopCode;
    }

    return pathCodes.map(code => {
      const coordinates = this.getZoneCoordinates(code);
      return { x: coordinates.x, y: coordinates.y };
    });
  }

  isChargingStation(zoneCode) {
    const normalized = String(zoneCode || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
    return normalized === 'estação carga' || normalized === 'estação de carga';
  }

  getZoneAtCoordinates(x, y) {
    let nearestZone = null;
    let nearestDistance = Infinity;

    Object.entries(this.zoneMap).forEach(([code, zone]) => {
      const distance = Math.hypot(x - zone.x, y - zone.y);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestZone = { code, distance };
      }
    });

    return nearestDistance <= 25 ? nearestZone : null;
  }

  isAtChargingStation(agv) {
    const station = this.getZoneAtCoordinates(agv.x, agv.y);
    return station !== null && station.code === 'Estação Carga';
  }

  /**
   * Loop principal de atualização da física (60 FPS).
   * Calcula o tempo decorrido (dt) entre frames para garantir que o movimento
   * e a simulação de bateria sejam independentes da taxa de atualização do ecrã.
   */
  loop(timestamp) {
    // Normalização do delta time (dt) em segundos, com um limite máximo de 0.1s para prevenir saltos se a aba ficar inativa
    const dt = Math.min((timestamp - this.lastTick) / 1000, 0.1);
    this.lastTick = timestamp;

    this.updateAGVPhysics(dt);

    this.animationFrame = requestAnimationFrame(this.loop);
  }

  /**
   * Atualização contínua da posição, ângulo, consumo elétrico e gestão de bateria do AGV.
   */
  updateAGVPhysics(dt) {
    const agv = store.state.agv;
    const atChargingStation = this.isAtChargingStation(agv);

    if (atChargingStation) {
      agv.location = 'Estação Carga';
    } else if (agv.status === 'charging') {
      const zone = this.getZoneAtCoordinates(agv.x, agv.y);
      agv.status = 'online';
      agv.location = zone?.code || 'Zona Desconhecida';
      agv.current = 0.2;
      agv.speed = 0.0;
      this.chargingInterrupted = false;
      this.chargingStationExited = false;
      store.updateAGV({
        status: agv.status,
        location: agv.location,
        current: agv.current,
        speed: agv.speed
      });
    }

    // A carregação só pode começar na estação de carga. Ao interromper,
    // o AGV deve sair da estação antes de poder retomar a carga depois.
    if (this.chargingInterrupted && !atChargingStation) {
      this.chargingStationExited = true;
    }

    if (
      atChargingStation &&
      agv.status !== 'error' &&
      !this.currentTask &&
      !this.currentRoute &&
      agv.battery < 100 &&
      (!this.chargingInterrupted || this.chargingStationExited)
    ) {
      this.chargingStopped = false;
      this.chargingInterrupted = false;
      this.chargingStationExited = false;
      agv.status = 'charging';
    }

    // --- Simulação Dinâmica de Consumo e Carga da Bateria ---
    if (agv.status === 'moving') {
      // Quando em movimento, consome bateria proporcionalmente ao tempo e simula variação de corrente nos motores
      agv.battery = Math.max(5, agv.battery - 0.005 * dt * 10);
      agv.speed = 0.85 + (Math.random() * 0.05); // Velocidade média real ~0.85 m/s com ligeiro ruído
      agv.current = 2.1 + (Math.random() * 0.2);  // Consumo ~2.1 Ampères
    } else if (agv.status === 'charging') {
      // Na estação de carregamento, recarrega gradualmente a bateria e regista corrente negativa (entrada de energia)
      agv.battery = Math.min(100, agv.battery + 0.05 * dt * 10);
      agv.speed = 0.0;
      agv.current = agv.battery >= 100 ? 0.2 : -3.5;

      // Mantém o estado de carregamento até a ação manual, inclusive em 100%.
      // Isto permite que o utilizador interrompa o carregamento e mova o AGV.
      if (agv.battery >= 100) {
        agv.currentTaskId = null;
      }
    } else {
      // Em repouso (Standby), mantém consumo residual mínimo
      agv.speed = 0.0;
      agv.current = 0.2;
    }

    if (agv.status === 'charging' || agv.status === 'online' && atChargingStation) {
      store.updateAGV({
        status: agv.status,
        battery: Number(agv.battery.toFixed(1)),
        current: Number(agv.current.toFixed(1)),
        speed: Number(agv.speed.toFixed(2))
      });
    }

    if (agv.status === 'moving' && !this.waypoints[this.waypointIndex]) {
      const failedTask = this.currentTask;
      const failedRoute = this.currentRoute;
      this.currentTask = null;
      this.currentRoute = null;
      this.waypoints = [];
      this.waypointIndex = 0;

      if (failedTask) {
        store.updateTaskStatus(failedTask.id, 'erro');
      }
      store.updateAGV({ status: 'error', speed: 0.0 });
      store.addLog(
        'error',
        failedTask
          ? `Navegação interrompida: tarefa ${failedTask.id} sem waypoint válido.`
          : `Navegação interrompida${failedRoute ? ` na rota ${failedRoute.name}` : ''}: sem waypoint válido.`
      );
      return;
    }

    // --- Execução da Navegação Autónoma por Waypoints ---
    if (agv.status === 'moving' && this.waypoints.length > 0 && !this.isPaused) {
      const target = this.waypoints[this.waypointIndex];
      const dx = target.x - agv.x;
      const dy = target.y - agv.y;
      
      // Distância euclidiana d = sqrt(dx^2 + dy^2) até ao waypoint de destino
      const distance = Math.hypot(dx, dy);

      // Trigonometria: Calcula o ângulo de orientação necessário rumo ao destino (em radianos)
      const targetAngle = Math.atan2(dy, dx);
      const angleDelta = Math.atan2(
        Math.sin(targetAngle - agv.angle),
        Math.cos(targetAngle - agv.angle)
      );

      // Interpolação suave de rotação (Lerp) para evitar rotações instantâneas irrealistas do robô
      agv.angle += angleDelta * 0.1;

      // Tolerância de chegada: Se a distância for menor que 5 píxeis, avança para o próximo waypoint
      if (distance < 5) {
        this.waypointIndex++;
        if (this.waypointIndex >= this.waypoints.length) {
          // Chegou ao destino final do percurso completo
          this.onPathComplete();
          return;
        }
      } else {
        // Deslocamento vetorial contínuo baseado nas componentes de cosseno e seno da orientação do robô
        const step = this.speedMultiplier * 60 * dt;
        const travel = Math.min(step, distance);
        agv.x += (dx / distance) * travel;
        agv.y += (dy / distance) * travel;
      }

      // Atualiza os valores na store central para sincronização com a interface e gráficos
      store.updateAGV({
        x: agv.x,
        y: agv.y,
        angle: agv.angle,
        speed: agv.speed,
        battery: Number(agv.battery.toFixed(1)),
        current: Number(agv.current.toFixed(1))
      });
    }
  }

  /**
   * Executa uma rota predefinida percorrendo as zonas pela ordem guardada.
   */
  dispatchRoute(route) {
    const agv = store.state.agv;
    if (
      !route ||
      !Array.isArray(route.waypoints) ||
      route.waypoints.length < 2 ||
      this.currentTask ||
      this.currentRoute ||
      agv.status !== 'online'
    ) return false;

    const startCode = this.getClosestZoneCode(agv.x, agv.y);
    const waypoints = this.buildWaypoints(route.waypoints, startCode);
    if (!waypoints) {
      store.addLog('error', `Não foi possível iniciar a rota ${route.name}: contém uma zona inválida.`);
      return false;
    }

    this.currentRoute = route;
    this.chargingStopped = false;
    this.waypoints = waypoints;
    this.waypointIndex = 0;
    this.routePreparationStartCode = startCode;
    store.updateAGV({ status: 'prep', currentTaskId: null, carriedBoxId: null });
    store.addLog('info', `AGV a preparar a rota ${route.name}: ${route.waypoints.join(' ➔ ')}`);

    setTimeout(() => {
      if (this.currentRoute?.id !== route.id) return;
      this.routePreparationReady = true;
      if (this.emergencyStopActive) return;
      store.updateAGV({ status: 'moving', location: startCode });
      this.routePreparationReady = false;
      this.routePreparationStartCode = null;
      store.addLog('info', `AGV iniciou a rota predefinida ${route.name}.`);
    }, 1500);
    return true;
  }

  /**
   * Prepara e envia uma tarefa de transporte para o AGV.
   * Cria os waypoints de rota: Posição Atual -> Zona de Origem (Recolha) -> Zona de Destino (Entrega).
   */
  dispatchTask(task) {
    const agv = store.state.agv;
    if (
      !task ||
      task.status !== 'aguardando' ||
      this.currentTask ||
      this.currentRoute ||
      this.emergencyStopActive ||
      agv.status !== 'online'
    ) return false;

    this.currentTask = task;
    this.chargingStopped = false;

    // Coloca a tarefa em estado de preparação
    store.updateTaskStatus(task.id, 'preparacao');
    store.updateAGV({
      status: 'prep',
      currentTaskId: task.id
    });
    store.addLog('info', `AGV iniciando preparação para tarefa ${task.id} (${task.origin} ➔ ${task.destination})`);

    const startCode = this.getClosestZoneCode(agv.x, agv.y);
    const waypoints = this.buildWaypoints([task.origin, task.destination], startCode);
    if (!waypoints) {
      store.updateTaskStatus(task.id, 'erro');
      store.updateAGV({ status: 'error', currentTaskId: null });
      store.addLog('error', `Rota inválida para a tarefa ${task.id}: origem ou destino não identificados.`);
      this.currentTask = null;
      this.waypoints = [];
      return false;
    }
    this.waypoints = waypoints;
    this.waypointIndex = 0;
    this.taskPreparationStartCode = startCode;

    // Simula tempo de verificação física / validação da caixa por RFID (1.5 segundos de pausa antes de arrancar)
    setTimeout(() => {
      if (this.currentTask?.id !== task.id) return;
      this.taskPreparationReady = true;
      if (!this.emergencyStopActive) this.startPreparedTask(task, startCode);
    }, 1500);
    return true;
  }

  startPreparedTask(task, startCode) {
    if (this.emergencyStopActive || this.currentTask?.id !== task.id) return;

    this.waypointIndex = 0;
    store.updateTaskStatus(task.id, 'em_movimento');
    store.updateAGV({
      status: 'moving',
      location: startCode,
      carriedBoxId: task.boxId
    });
    store.updateBoxLocation(task.boxId, task.origin, 'em_transito');
    this.taskPreparationReady = false;
    this.taskPreparationStartCode = null;
    store.addLog('info', `AGV em movimento com caixa ${task.boxId} rumo a ${task.destination}`);
  }

  /**
   * Executado quando o AGV conclui com sucesso a rota de entrega.
   */
  onPathComplete() {
    if (this.currentRoute) {
      const route = this.currentRoute;
      const destination = route.waypoints[route.waypoints.length - 1];
      const destinationCoords = this.getZoneCoordinates(destination);
      const shouldCharge = this.isChargingStation(destination) && store.state.agv.battery < 100;
      this.currentRoute = null;
      this.waypoints = [];
      this.waypointIndex = 0;
      store.updateAGV({
        status: shouldCharge ? 'charging' : 'online',
        location: destination,
        x: destinationCoords ? destinationCoords.x : store.state.agv.x,
        y: destinationCoords ? destinationCoords.y : store.state.agv.y,
        currentTaskId: null,
        carriedBoxId: null,
        speed: 0.0
      });
      store.addLog('success', `Rota predefinida ${route.name} concluída.`);
      return;
    }

    if (!this.currentTask) return;
    const task = this.currentTask;

    // Atualiza localização da caixa e marca-a como disponível no destino
    store.updateBoxLocation(task.boxId, task.destination, 'disponivel');
    
    // Conclui a tarefa e regista o evento de sucesso
    store.updateTaskStatus(task.id, 'concluida');
    store.addLog('success', `✔ Tarefa ${task.id} CONCLUÍDA com sucesso! Caixa ${task.boxId} entregue em ${task.destination}.`);

    // Quando a entrega termina na estação de carga, o AGV entra num estado
    // temporário de carregamento. Nas demais zonas, volta ao estado de espera.
    const isChargingDestination = this.isChargingStation(task.destination);
    const destinationCoords = this.getZoneCoordinates(task.destination);
    store.updateAGV({
      status: isChargingDestination ? 'charging' : 'online',
      location: task.destination,
      x: destinationCoords ? destinationCoords.x : store.state.agv.x,
      y: destinationCoords ? destinationCoords.y : store.state.agv.y,
      currentTaskId: null,
      carriedBoxId: null,
      speed: 0.0
    });

    this.currentTask = null;
    this.waypoints = [];
    this.waypointIndex = 0;
  }

  /**
   * Interrompe o carregamento quando a bateria tiver pelo menos 10%.
   * O AGV passa para estado operacional e pode receber uma nova ordem de movimento.
   */
  stopCharging() {
    const agv = store.state.agv;
    if (agv.status !== 'charging') return false;
    if (agv.battery < 10) {
      store.addLog('warning', 'Carregamento não interrompido: a bateria está abaixo de 10%.');
      return false;
    }

    this.waypoints = [];
    this.waypointIndex = 0;
    this.chargingStopped = true;
    this.chargingInterrupted = true;
    this.chargingStationExited = false;
    store.updateAGV({
      status: 'online',
      currentTaskId: null,
      carriedBoxId: null,
      speed: 0.0,
      sensorObstacle: false
    });
    store.addLog('info', `Carregamento interrompido manualmente. Bateria: ${agv.battery.toFixed(1)}%.`);
    return true;
  }

  /**
   * Aciona o travão de emergência imediato (Corte de tração e emissão de alerta).
   */
  triggerEmergencyStop() {
    if (this.emergencyStopActive) return;
    this.emergencyStopActive = true;
    this.emergencyResumeStatus = store.state.agv.status;

    store.updateAGV({
      status: 'error',
      speed: 0.0,
      sensorObstacle: true
    });
    store.addLog('error', `🔴 PARAGEM DE EMERGÊNCIA acionada no AGV! A tarefa atual foi pausada.`);
  }

  /**
   * Desbloqueia a paragem de emergência e devolve o AGV ao estado operacional.
   */
  clearEmergencyStop() {
    if (!this.emergencyStopActive) return;
    const resumeStatus = this.emergencyResumeStatus;
    this.emergencyStopActive = false;
    this.emergencyResumeStatus = null;

    store.updateAGV({
      status: resumeStatus || 'online',
      sensorObstacle: false
    });

    if (resumeStatus === 'moving') {
      store.updateAGV({ status: 'moving' });
    } else if (resumeStatus === 'prep' && this.taskPreparationReady && this.currentTask) {
      this.startPreparedTask(this.currentTask, this.taskPreparationStartCode);
    } else if (resumeStatus === 'prep' && this.routePreparationReady && this.currentRoute) {
      store.updateAGV({
        status: 'moving',
        location: this.routePreparationStartCode
      });
      this.routePreparationReady = false;
      this.routePreparationStartCode = null;
    }

    store.addLog('info', `🟢 Paragem de emergência desativada. A tarefa pode continuar.`);
  }

  /**
   * Teleoperação manual direta por passos de deslocamento.
   */
  manualDrive(direction) {
    const agv = store.state.agv;
    if (
      this.emergencyStopActive ||
      !['UP', 'DOWN', 'LEFT', 'RIGHT'].includes(direction)
    ) return false;

    const interruptedTask = this.currentTask;
    const interruptedRoute = this.currentRoute;
    if (interruptedTask) {
      store.updateTaskStatus(interruptedTask.id, 'erro');
    }
    if (interruptedTask || interruptedRoute) {
      store.addLog('warning', 'Navegação automática interrompida para controlo manual.');
    }

    this.currentTask = null;
    this.currentRoute = null;
    this.waypoints = [];
    this.waypointIndex = 0;
    if (agv.status === 'charging' || this.isAtChargingStation(agv)) {
      this.chargingInterrupted = true;
      this.chargingStationExited = false;
    }

    const step = 15; // Deslocamento em píxeis por cada toque no joystick
    this.chargingStopped = false;

    if (direction === 'UP') agv.y -= step;
    if (direction === 'DOWN') agv.y += step;
    if (direction === 'LEFT') agv.x -= step;
    if (direction === 'RIGHT') agv.x += step;

    store.updateAGV({
      x: agv.x,
      y: agv.y,
      status: 'online',
      currentTaskId: null,
      carriedBoxId: null,
      speed: 0.0,
      sensorObstacle: false
    });
    return true;
  }
}

export const agvSimulator = new AGVSimulator();
