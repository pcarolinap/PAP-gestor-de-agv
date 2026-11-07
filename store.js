/**
 * ANDA LÁ — Data Store & State Management Module
 * 
 * Módulo de gestão de estado reativo e persistência local de dados.
 * Implementa o padrão de arquitetura Pub/Sub (Publish/Subscribe), garantindo que
 * qualquer alteração no estado (posição do AGV, novas tarefas, inventário de caixas, registos)
 * notifique automaticamente a interface para atualização dinâmica sem recarregar a página.
 */

const STORAGE_KEY = 'ANDA_LA_STATE_V1';

export const FACTORY_CONNECTIONS = [
  ['Zona A', 'Zona B'],
  ['Zona B', 'Zona D'],
  ['Zona D', 'Zona C'],
  ['Zona C', 'Zona B'],
  ['Zona C', 'Zona A'],
  ['Zona B', 'Estação Carga'],
  ['Zona C', 'Estação Carga'],
  ['Zona D', 'Estação Carga']
];

// Estado inicial padrão (Seed Data) fornecido na primeira inicialização do sistema
const defaultState = {
  agv: {
    id: 'AGV-01',
    name: 'ANDA LÁ — Unit 01',
    status: 'online', // Estados possíveis: 'online' | 'prep' | 'moving' | 'charging' | 'error' | 'offline'
    battery: 88,     // Percentagem da bateria (0 a 100%)
    voltage: 24.2,   // Tensão nominal dos motores (Volts)
    current: 1.4,    // Corrente de consumo (Ampères)
    speed: 0.0,      // Velocidade instantânea (m/s)
    location: 'Zona A',
    x: 120,          // Coordenada X no canvas
    y: 180,          // Coordenada Y no canvas
    angle: 0,        // Orientação em radianos
    targetNodeId: null,
    currentTaskId: null,
    carriedBoxId: null,
    rssi: -58,       // Intensidade do sinal Wi-Fi (dBm)
    esp32Ip: '192.168.1.145',
    hardwareConnected: true,
    sensorObstacle: false,
    lineFollowerOk: true
  },
  
  // Lista das zonas fabris e respetivas posições no mapa de coordenadas
  zones: [
    { id: 'zone-a', name: 'Zona A — Receção & Triagem', code: 'Zona A', x: 120, y: 180, color: '#3B82F6', icon: 'ph-download-simple' },
    { id: 'zone-b', name: 'Zona B — Armazém de Componentes', code: 'Zona B', x: 450, y: 120, color: '#8B5CF6', icon: 'ph-warehouse' },
    { id: 'zone-c', name: 'Zona C — Linha de Montagem 1', code: 'Zona C', x: 450, y: 380, color: '#10B981', icon: 'ph-wrench' },
    { id: 'zone-d', name: 'Zona D — Expedição Final', code: 'Zona D', x: 800, y: 380, color: '#F59E0B', icon: 'ph-truck' },
    { id: 'dock', name: 'Estação de Carga & Repouso', code: 'Estação Carga', x: 800, y: 120, color: '#EC4899', icon: 'ph-lightning' }
  ],

  // Rotas reutilizáveis construídas com as zonas existentes no mapa.
  routes: [
    { id: 'RTE-001', name: 'Ronda de Produção', waypoints: ['Zona A', 'Zona B', 'Zona D', 'Zona C', 'Zona A'] },
    { id: 'RTE-002', name: 'Abastecimento e Carga', waypoints: ['Zona A', 'Zona B', 'Estação Carga'] }
  ],

  // Inventário inicial de caixas de peças registadas no sistema
  boxes: [
    {
      id: 'BOX-023',
      rfidTag: 'E200-4106-9912-0023',
      qrCode: 'BOX-023-PNEU-SPORT',
      description: 'Conjunto de Amortecedores e Travões',
      content: '4x Amortecedores Desportivos + Pastilhas Brembo',
      weightKg: 18.5,
      location: 'Zona A',
      status: 'disponivel', // 'disponivel' | 'em_transito' | 'entregue'
      lastUpdated: '15/09/2026 14:20'
    },
    {
      id: 'BOX-024',
      rfidTag: 'E200-4106-9912-0024',
      qrCode: 'BOX-024-MOTOR-V6',
      description: 'Módulo Controladores ECU & Cablagem',
      content: '2x Unidades de Controlo Eletrónico ECU',
      weightKg: 8.2,
      location: 'Zona B',
      status: 'disponivel',
      lastUpdated: '15/09/2026 16:45'
    },
    {
      id: 'BOX-025',
      rfidTag: 'E200-4106-9912-0025',
      qrCode: 'BOX-025-FILTROS-OLEO',
      description: 'Componentes de Injeção Direta',
      content: '12x Injetores Alta Pressão Bosch',
      weightKg: 5.4,
      location: 'Zona A',
      status: 'disponivel',
      lastUpdated: '16/09/2026 09:10'
    },
    {
      id: 'BOX-026',
      rfidTag: 'E200-4106-9912-0026',
      qrCode: 'BOX-026-CHASSIS-LIGHT',
      description: 'Parafusos e Fixações Industriais',
      content: 'Lote 500x Parafusos M8 Aço Inoxidável',
      weightKg: 12.0,
      location: 'Zona C',
      status: 'entregue',
      lastUpdated: '16/09/2026 11:30'
    }
  ],

  // Tarefas de transporte registadas
  tasks: [
    {
      id: 'TSK-101',
      boxId: 'BOX-023',
      origin: 'Zona A',
      destination: 'Zona C',
      agvId: 'AGV-01',
      status: 'concluida', // 'aguardando' | 'preparacao' | 'em_movimento' | 'concluida' | 'erro'
      priority: 'alta',
      createdAt: '15/09/2026 10:15',
      completedAt: '15/09/2026 10:22',
      operator: 'admin'
    },
    {
      id: 'TSK-102',
      boxId: 'BOX-024',
      origin: 'Zona B',
      destination: 'Zona D',
      agvId: 'AGV-01',
      status: 'concluida',
      priority: 'normal',
      createdAt: '15/09/2026 14:30',
      completedAt: '15/09/2026 14:38',
      operator: 'operador1'
    }
  ],

  // Registos históricos de auditoria de eventos e erros
  logs: [
    { id: 'LOG-001', type: 'info', message: 'Sistema ANDA LÁ inicializado com sucesso.', timestamp: '15/09/2026 08:00:00' },
    { id: 'LOG-002', type: 'success', message: 'Tarefa TSK-101 concluída. Caixa BOX-023 entregue na Zona C.', timestamp: '15/09/2026 10:22:14' },
    { id: 'LOG-003', type: 'warning', message: 'Nível de bateria abaixo de 20% detetado no AGV-01. Recomendada recarga.', timestamp: '16/09/2026 18:05:22' }
  ],

  alerts: [
    { id: 'ALT-01', level: 'warning', title: 'Manutenção de Rotina', message: 'Verificação dos sensores óticos agendada para 20/09.', active: true, time: 'Há 2h' }
  ],

  currentUser: null,
  users: []
};

class Store {
  constructor() {
    this.state = this.loadState();
    this.listeners = []; // Lista de funções observadoras inscritas para receber notificações
  }

  /**
   * Carrega o estado a partir do LocalStorage do navegador se existir, caso contrário devolve o estado inicial.
   */
  loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && parsed.agv && typeof parsed.agv === 'object') {
          const fallback = JSON.parse(JSON.stringify(defaultState));
          const normalized = {
            ...fallback,
            ...parsed,
            agv: { ...fallback.agv, ...parsed.agv },
            zones: Array.isArray(parsed.zones) && parsed.zones.length > 0 ? parsed.zones : fallback.zones,
            routes: Array.isArray(parsed.routes) ? parsed.routes : fallback.routes,
            boxes: Array.isArray(parsed.boxes) && parsed.boxes.length > 0 ? parsed.boxes : fallback.boxes,
            users: Array.isArray(parsed.users) && parsed.users.length > 0 ? parsed.users : fallback.users
          };

          const x = Number(normalized.agv.x);
          const y = Number(normalized.agv.y);
          const angle = Number(normalized.agv.angle);
          if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(angle)) {
            normalized.agv.x = fallback.agv.x;
            normalized.agv.y = fallback.agv.y;
            normalized.agv.angle = fallback.agv.angle;
          }

          return normalized;
        }
      }
    } catch (e) {
      console.warn('Não foi possível ler o estado do localStorage:', e);
    }
    return JSON.parse(JSON.stringify(defaultState));
  }

  /**
   * Guarda a alteração atual no LocalStorage e notifica todos os componentes subscritos.
   */
  saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      this.notify();
    } catch (e) {
      console.error('Erro ao guardar estado no localStorage:', e);
    }
  }

  /**
   * Subscreve uma função de callback que será executada sempre que o estado for modificado.
   */
  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Dispara o evento de atualização para todas as funções de escuta ativas.
   */
  notify() {
    this.listeners.forEach(listener => listener(this.state));
  }

  // --- Atualizações parciais do AGV ---
  updateAGV(partialState) {
    this.state.agv = { ...this.state.agv, ...partialState };
    this.saveState();
  }

  // --- Gestão de Rotas Predefinidas ---
  getRoutes() {
    return this.state.routes;
  }

  addRoute(routeData) {
    const name = String(routeData.name || '').trim();
    const waypoints = Array.isArray(routeData.waypoints) ? routeData.waypoints : [];
    if (name.length === 0 || waypoints.length < 2) return null;
    if (waypoints.some(code => !this.state.zones.some(zone => zone.code === code))) return null;
    if (this.state.routes.some(route => route.name.toLowerCase() === name.toLowerCase())) return null;

    const route = {
      id: `RTE-${Date.now().toString(36).toUpperCase()}`,
      name,
      waypoints: [...waypoints]
    };
    this.state.routes.unshift(route);
    this.addLog('info', `Rota predefinida criada: ${route.name} (${route.waypoints.join(' ➔ ')})`);
    this.saveState();
    return route;
  }

  updateRoute(routeId, routeData) {
    const route = this.state.routes.find(item => item.id === routeId);
    const name = String(routeData.name || '').trim();
    const waypoints = Array.isArray(routeData.waypoints) ? routeData.waypoints : [];
    if (!route || name.length === 0 || waypoints.length < 2) return false;
    if (waypoints.some(code => !this.state.zones.some(zone => zone.code === code))) return false;
    if (this.state.routes.some(item => item.id !== routeId && item.name.toLowerCase() === name.toLowerCase())) return false;

    route.name = name;
    route.waypoints = [...waypoints];
    this.addLog('info', `Rota predefinida atualizada: ${route.name}`);
    this.saveState();
    return true;
  }

  removeRoute(routeId) {
    const routeIndex = this.state.routes.findIndex(item => item.id === routeId);
    if (routeIndex === -1) return false;
    const [route] = this.state.routes.splice(routeIndex, 1);
    this.addLog('warning', `Rota predefinida removida: ${route.name}`);
    this.saveState();
    return true;
  }

  // --- Gestão de Tarefas ---
  getTasks() {
    return this.state.tasks;
  }

  addTask(taskData) {
    if (this.state.currentUser?.role !== 'Administrador') return null;

    const newTask = {
      id: `TSK-${Math.floor(100 + Math.random() * 900)}`,
      status: 'aguardando',
      priority: taskData.priority || 'normal',
      createdAt: new Date().toLocaleString('pt-PT'),
      completedAt: null,
      operator: this.state.currentUser.name,
      ...taskData
    };
    this.state.tasks.unshift(newTask);

    this.addLog('info', `Nova tarefa criada: ${newTask.id} (${newTask.boxId}: ${newTask.origin} ➔ ${newTask.destination})`);
    this.saveState();
    return newTask;
  }

  updateTask(taskId, taskData) {
    const task = this.state.tasks.find(item => item.id === taskId);
    if (!task || task.status !== 'aguardando') return false;

    Object.assign(task, {
      boxId: taskData.boxId,
      origin: taskData.origin,
      destination: taskData.destination,
      priority: taskData.priority
    });
    this.addLog('info', `Tarefa atualizada: ${task.id} (${task.origin} ➔ ${task.destination})`);
    this.saveState();
    return true;
  }

  removeTask(taskId) {
    const taskIndex = this.state.tasks.findIndex(item => item.id === taskId);
    if (taskIndex === -1 || this.state.tasks[taskIndex].status !== 'aguardando') return false;

    const [removedTask] = this.state.tasks.splice(taskIndex, 1);
    this.addLog('warning', `Tarefa removida: ${removedTask.id}`);
    this.saveState();
    return true;
  }

  updateTaskStatus(taskId, status, extra = {}) {
    const task = this.state.tasks.find(t => t.id === taskId);
    if (task) {
      task.status = status;
      if (status === 'concluida') {
        task.completedAt = new Date().toLocaleString('pt-PT');
      }
      Object.assign(task, extra);
      this.saveState();
    }
  }

  // --- Gestão de Utilizadores ---
  getUsers() {
    return this.state.users;
  }

  addUser(userData) {
    const username = String(userData.username || '').trim().toLowerCase();
    if (!username || !userData.password || !userData.role) return null;
    if (this.state.users.some(user => user.username.toLowerCase() === username)) return null;

    const user = {
      id: `user-${Date.now().toString(36)}`,
      username,
      name: userData.name.trim() || username,
      password: userData.password,
      role: userData.role,
      active: userData.active !== false
    };
    this.state.users.unshift(user);
    this.saveState();
    return user;
  }

  updateUser(userId, userData) {
    const user = this.state.users.find(item => item.id === userId);
    if (!user) return false;

    if (userData.username) {
      const username = userData.username.trim().toLowerCase();
      if (this.state.users.some(item => item.id !== userId && item.username.toLowerCase() === username)) return false;
      user.username = username;
    }
    if (userData.name !== undefined) user.name = userData.name.trim() || user.username;
    if (userData.password !== undefined) user.password = userData.password;
    if (userData.role !== undefined) user.role = userData.role;
    if (userData.active !== undefined) user.active = Boolean(userData.active);
    this.saveState();
    return true;
  }

  removeUser(userId) {
    const index = this.state.users.findIndex(user => user.id === userId);
    if (index === -1) return false;
    this.state.users.splice(index, 1);
    this.saveState();
    return true;
  }

  // --- Gestão de Inventário de Caixas ---
  getBoxes() {
    return this.state.boxes;
  }

  addBox(boxData) {
    const newBox = {
      id: boxData.id || `BOX-${Math.floor(100 + Math.random() * 900)}`,
      rfidTag: boxData.rfidTag || `E200-4106-9912-0${Math.floor(100 + Math.random() * 900)}`,
      qrCode: boxData.qrCode || `BOX-QR-${Math.floor(1000 + Math.random() * 9000)}`,
      description: boxData.description || 'Caixa de Componentes',
      content: boxData.content || 'Peças Industriais Várias',
      weightKg: boxData.weightKg || 10.0,
      location: boxData.location || 'Zona A',
      status: 'disponivel',
      lastUpdated: new Date().toLocaleString('pt-PT')
    };
    this.state.boxes.unshift(newBox);
    this.addLog('info', `Nova caixa registada: ${newBox.id} (${newBox.rfidTag})`);
    this.saveState();
    return newBox;
  }

  updateBox(boxId, boxData) {
    const box = this.state.boxes.find(item => item.id === boxId);
    if (!box) return false;

    // Atualiza apenas os campos editáveis, preservando ID, estado operacional e referências.
    Object.assign(box, {
      rfidTag: boxData.rfidTag,
      description: boxData.description,
      content: boxData.content,
      weightKg: boxData.weightKg,
      location: boxData.location,
      lastUpdated: new Date().toLocaleString('pt-PT')
    });
    this.addLog('info', `Caixa atualizada: ${box.id} (${box.rfidTag})`);
    this.saveState();
    return true;
  }

  removeBox(boxId) {
    // Mantém no inventário as caixas que ainda possam estar a ser movimentadas.
    const activeTask = this.state.tasks.find(task =>
      task.boxId === boxId && ['aguardando', 'preparacao', 'em_movimento'].includes(task.status)
    );
    if (activeTask) return false;

    const boxIndex = this.state.boxes.findIndex(box => box.id === boxId);
    if (boxIndex === -1) return false;

    const [removedBox] = this.state.boxes.splice(boxIndex, 1);
    this.addLog('warning', `Caixa removida do inventário: ${removedBox.id}`);
    this.saveState();
    return true;
  }

  updateBoxLocation(boxId, newLocation, newStatus) {
    const box = this.state.boxes.find(b => b.id === boxId);
    if (box) {
      box.location = newLocation;
      if (newStatus) box.status = newStatus;
      box.lastUpdated = new Date().toLocaleString('pt-PT');
      this.saveState();
    }
  }

  // --- Adicionar Registo de Auditoria ---
  addLog(type, message) {
    const newLog = {
      id: `LOG-${Date.now().toString(36).toUpperCase()}`,
      type, // 'info' | 'success' | 'warning' | 'error'
      message,
      timestamp: new Date().toLocaleString('pt-PT')
    };
    this.state.logs.unshift(newLog);
    
    // Limita o histórico aos últimos 100 eventos para economizar memória
    if (this.state.logs.length > 100) this.state.logs.pop();
    this.saveState();
  }

  clearLogs() {
    this.state.logs = [];
    this.addLog('info', 'Histórico de registos limpo pelo utilizador.');
    this.saveState();
  }

  resetToDefaults() {
    this.state = JSON.parse(JSON.stringify(defaultState));
    this.saveState();
  }
}

export const store = new Store();
