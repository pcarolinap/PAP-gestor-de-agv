/**
 * ANDA LÁ — Main Application UI Controller
 * 
 * Controlador principal da interface de utilizador.
 * Responsável por:
 * 1. Gerir a navegação entre as diferentes vistas da SPA (Dashboard, Mapa, Tarefas, Caixas, Histórico, Hardware, Definições).
 * 2. Associar formulários de criação de tarefas e caixas a modais interativos.
 * 3. Registar eventos de paragem de emergência e teleoperação por joystick.
 * 4. Atualizar dinamicamente tabelas, contadores KPI e indicadores de telemetria em resposta às mudanças de estado da Store.
 * 5. Gerir alertas, toasts e exportação do histórico em formato CSV.
 */

import { store } from './store.js';
import { agvSimulator } from './agv-simulator.js';
import { FactoryMapRenderer } from './factory-map.js';
import { apiClient } from './api-client.js';

class App {
  constructor() {
    this.mapRenderer = null;
    this.manualMovementConfirmed = false;
    this.init();
  }

  canStartTaskOrRoute() {
    return store.state.agv.status === 'online' &&
      !agvSimulator.currentTask &&
      !agvSimulator.currentRoute &&
      !agvSimulator.emergencyStopActive;
  }

  populateTaskRouteSelect() {
    const routeSelect = document.getElementById('taskRouteSelect');
    if (!routeSelect) return;

    const routes = store.getRoutes();
    routeSelect.replaceChildren();
    if (routes.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Nenhuma rota predefinida disponível';
      routeSelect.append(option);
      routeSelect.disabled = true;
      return;
    }

    routes.forEach(route => {
      const option = document.createElement('option');
      option.value = route.id;
      option.textContent = `${route.name} — ${route.waypoints.join(' ➔ ')}`;
      routeSelect.append(option);
    });
    routeSelect.disabled = false;
  }

  init() {
    this.loadCurrentUserFromSession();

    // 1. Inicializa o renderizador gráfico dos canvas
    const canvas = document.getElementById('factoryCanvas');
    if (canvas) {
      this.mapRenderer = new FactoryMapRenderer(canvas);
    }

    const canvasMap = document.getElementById('factoryCanvasMap');
    if (canvasMap) {
      this.mapRendererMap = new FactoryMapRenderer(canvasMap);
    }

    // 2. Arranca o motor de física do simulador de navegação
    agvSimulator.start();

    // 3. Associa ouvintes de eventos a botões, formulários e vistas
    this.bindNavigation();
    this.bindFormsAndModals();
    this.bindHardwareControls();

    // 4. Testa a conexão ao ESP32, mas mantém o modo simulador como fallback
    apiClient.testConnection().then((result) => {
      if (!result.success) {
        store.addLog('warning', 'ESP32 não acessível. O AGV está a operar no modo de simulação integrada.');
      }
    });

    // 5. Subscreve a interface às alterações do estado central (Pub/Sub)
    store.subscribe((state) => this.renderUI(state));

    // Renderização inicial dos dados
    this.renderUI(store.state);

    // Loop de renderização contínuo do Canvas a 60 FPS
    const canvasLoop = () => {
      if (this.mapRenderer) {
        this.mapRenderer.render();
      }
      if (this.mapRendererMap) {
        this.mapRendererMap.render();
      }
      requestAnimationFrame(canvasLoop);
    };
    requestAnimationFrame(canvasLoop);

    this.showToast('Bem-vindo ao sistema ANDA LÁ — Automação Logística!', 'success');
  }

  loadCurrentUserFromSession() {
    let session = null;
    try {
      const sessionData = localStorage.getItem('andaLaSession')
        || sessionStorage.getItem('andaLaSession');
      session = sessionData ? JSON.parse(sessionData) : null;
    } catch (error) {
      console.warn('Não foi possível ler a sessão do utilizador:', error);
    }

    const username = String(session?.username || '').trim().toLowerCase();
    this.sessionUsername = username;
    const user = store.getUsers().find(
      item => item.username.toLowerCase() === username && item.active
    );
    store.state.currentUser = user
      ? { username: user.username, name: user.name, role: user.role }
      : null;
  }

  isAdministrator() {
    const user = store.getUsers().find(
      item => item.username.toLowerCase() === this.sessionUsername && item.active
    );
    store.state.currentUser = user
      ? { username: user.username, name: user.name, role: user.role }
      : null;
    return user?.role === 'Administrador';
  }

  isAuthenticated() {
    this.isAdministrator();
    return Boolean(store.state.currentUser);
  }

  /**
   * Navegação SPA sem recarregamento de página via atributos data-view.
   */
  bindNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const pageViews = document.querySelectorAll('.page-view');

    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const targetView = item.getAttribute('data-view');
        if (!targetView) return;

        // Alterna as classes ativas dos menus e das secções de vista
        navItems.forEach(n => n.classList.remove('active'));
        pageViews.forEach(v => v.classList.remove('active'));

        item.classList.add('active');
        const viewEl = document.getElementById(`view-${targetView}`);
        if (viewEl) {
          viewEl.classList.add('active');
          // Redimensiona os canvas ao alternar de vista
          if (targetView === 'dashboard' && this.mapRenderer) {
            this.mapRenderer.resizeCanvas();
          } else if (targetView === 'map' && this.mapRendererMap) {
            this.mapRendererMap.resizeCanvas();
          }
        }
      });
    });
  }

  /**
   * Associa os eventos de submissão e fecho dos modais de Tarefas e Caixas.
   */
  bindFormsAndModals() {
    // Modal de Nova Tarefa
    const btnNewTasks = [
      document.getElementById('btnNewTask'),
      document.getElementById('btnNewTaskManagement')
    ].filter(Boolean);
    const modalTask = document.getElementById('modalTask');
    const formTask = document.getElementById('formTask');
    const taskModalTitle = document.getElementById('taskModalTitle');
    const taskSubmitButton = document.getElementById('taskSubmitButton');
    const taskActionSelect = document.getElementById('taskActionSelect');
    const transportTaskFields = document.getElementById('transportTaskFields');
    const predefinedRouteFields = document.getElementById('predefinedRouteFields');
    const taskRouteSelect = document.getElementById('taskRouteSelect');
    this.editingTaskId = null;

    const updateTaskCreationMode = () => {
      const mode = taskActionSelect.value;
      const usesRoute = mode === 'predefined';
      transportTaskFields.hidden = usesRoute;
      predefinedRouteFields.hidden = !usesRoute;
      taskRouteSelect.required = usesRoute;
      document.getElementById('taskBoxSelect').required = !usesRoute;
      document.getElementById('taskOriginSelect').required = !usesRoute;
      document.getElementById('taskDestSelect').required = !usesRoute;
      taskSubmitButton.textContent = {
        pending: 'Guardar como pendente',
        execute: 'Criar e executar agora',
        predefined: 'Executar rota'
      }[mode];
    };

    if (modalTask) {
      btnNewTasks.forEach(button => button.addEventListener('click', () => {
        if (!this.isAdministrator()) {
          this.showToast('Só um administrador pode criar tarefas.', 'error');
          return;
        }
        this.editingTaskId = null;
        formTask.reset();
        this.populateTaskFormSelects();
        this.populateTaskRouteSelect();
        taskActionSelect.value = 'pending';
        updateTaskCreationMode();
        taskModalTitle.textContent = 'Criar Nova Tarefa de Transporte';
        modalTask.classList.add('open');
      }));
    }

    if (taskActionSelect) {
      taskActionSelect.addEventListener('change', updateTaskCreationMode);
      updateTaskCreationMode();
    }

    if (formTask) {
      formTask.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!this.isAdministrator()) {
          this.showToast('Só um administrador pode criar tarefas.', 'error');
          modalTask.classList.remove('open');
          return;
        }
        const mode = taskActionSelect.value;
        if (mode === 'predefined') {
          const route = store.getRoutes().find(item => item.id === taskRouteSelect.value);
          if (!route) {
            this.showToast('Selecione uma rota predefinida válida.', 'error');
            return;
          }

          const started = agvSimulator.dispatchRoute(route);
          if (!started) {
            this.showToast('O AGV não está disponível para executar esta rota.', 'warning');
            return;
          }

          this.showToast(`Rota "${route.name}" iniciada.`, 'success');
          modalTask.classList.remove('open');
          formTask.reset();
          updateTaskCreationMode();
          return;
        }

        const boxId = document.getElementById('taskBoxSelect').value;
        const origin = document.getElementById('taskOriginSelect').value;
        const destination = document.getElementById('taskDestSelect').value;
        const priority = document.getElementById('taskPrioritySelect').value;

        if (!boxId) {
          this.showToast('Selecione uma caixa antes de criar a tarefa.', 'error');
          return;
        }

        // Validação básica: Origem e Destino têm de ser diferentes
        if (origin === destination) {
          this.showToast('Origem e Destino não podem ser idênticos!', 'error');
          return;
        }

        if (mode === 'execute' && !this.canStartTaskOrRoute()) {
          this.showToast('O AGV não está disponível para executar uma tarefa agora.', 'warning');
          return;
        }

        if (this.editingTaskId) {
          const updated = store.updateTask(this.editingTaskId, { boxId, origin, destination, priority });
          this.showToast(updated ? `Tarefa ${this.editingTaskId} atualizada.` : 'Só é possível editar tarefas que aguardam execução.', updated ? 'success' : 'error');
        } else {
          const task = store.addTask({ boxId, origin, destination, priority });
          if (task) {
            if (mode === 'execute') {
              const started = agvSimulator.dispatchTask(task);
              if (!started) {
                store.removeTask(task.id);
                this.showToast('Não foi possível iniciar a tarefa. O AGV continua disponível?', 'warning');
                return;
              }
              apiClient.sendTaskToESP32(task)
                .then(result => {
                  const modeLabel = result?.mode === 'simulated' ? 'modo de simulação' : 'ESP32';
                  this.showToast(`Tarefa ${task.id} iniciada no ${modeLabel}.`, result?.success === false ? 'error' : 'success');
                })
                .catch(error => this.showToast(`Não foi possível enviar a tarefa ao AGV: ${error.message}`, 'error'));
            } else {
              this.showToast(`Tarefa ${task.id} guardada como pendente.`, 'success');
            }
          } else {
            this.showToast('Não foi possível criar a tarefa. Confirme as permissões de administrador.', 'error');
          }
        }

        modalTask.classList.remove('open');
        this.editingTaskId = null;
        formTask.reset();
        updateTaskCreationMode();
      });
    }

    const tasksTableBody = document.getElementById('tasksTableBody');
    if (tasksTableBody) {
      tasksTableBody.addEventListener('click', event => {
        const button = event.target.closest('button[data-task-action="run"]');
        if (!button) return;
        if (!this.isAuthenticated()) {
          this.showToast('Inicie sessão para executar tarefas pendentes.', 'error');
          return;
        }

        const task = store.getTasks().find(item => item.id === button.dataset.taskId);
        const started = task && agvSimulator.dispatchTask(task);
        if (!started) {
          this.showToast('O AGV não está disponível para executar esta tarefa.', 'warning');
          return;
        }

        apiClient.sendTaskToESP32(task)
          .then(result => {
            const mode = result?.mode === 'simulated' ? 'modo de simulação' : 'ESP32';
            this.showToast(
              `Tarefa ${task.id} enviada para execução no ${mode}.`,
              result?.success === false ? 'error' : 'success'
            );
          })
          .catch(error => this.showToast(`Não foi possível enviar a tarefa ao AGV: ${error.message}`, 'error'));
      });
    }

    const btnNewRoute = document.getElementById('btnNewRoute');
    const modalRoute = document.getElementById('modalRoute');
    const formRoute = document.getElementById('formRoute');
    const routeStopsList = document.getElementById('routeStopsList');
    const routesTableBody = document.getElementById('routesTableBody');
    this.editingRouteId = null;

    if (btnNewRoute && modalRoute) {
      btnNewRoute.addEventListener('click', () => {
        this.editingRouteId = null;
        formRoute.reset();
        this.setRouteStops();
        document.getElementById('routeModalTitle').textContent = 'Criar rota predefinida';
        document.getElementById('routeSubmitButton').textContent = 'Guardar rota';
        modalRoute.classList.add('open');
      });
    }

    const btnAddRouteStop = document.getElementById('btnAddRouteStop');
    if (btnAddRouteStop) {
      btnAddRouteStop.addEventListener('click', () => this.addRouteStop());
    }

    if (formRoute) {
      formRoute.addEventListener('submit', event => {
        event.preventDefault();
        const name = document.getElementById('routeNameInput').value.trim();
        const waypoints = [...routeStopsList.querySelectorAll('select')].map(select => select.value);
        if (waypoints.length < 2 || waypoints.some(code => !code)) {
          this.showToast('Escolha pelo menos duas paragens para a rota.', 'error');
          return;
        }

        const routeData = { name, waypoints };
        const result = this.editingRouteId
          ? store.updateRoute(this.editingRouteId, routeData)
          : store.addRoute(routeData);
        if (!result) {
          this.showToast('Não foi possível guardar. Verifique o nome e as paragens da rota.', 'error');
          return;
        }

        this.showToast(this.editingRouteId ? 'Rota atualizada.' : 'Rota criada.', 'success');
        modalRoute.classList.remove('open');
        formRoute.reset();
        this.editingRouteId = null;
      });
    }

    if (routesTableBody && modalRoute) {
      routesTableBody.addEventListener('click', event => {
        const button = event.target.closest('button[data-route-action]');
        if (!button) return;
        const route = store.getRoutes().find(item => item.id === button.dataset.routeId);
        if (!route) return;

        if (button.dataset.routeAction === 'run') {
          const started = agvSimulator.dispatchRoute(route);
          this.showToast(
            started ? `Rota "${route.name}" iniciada.` : 'O AGV não está disponível para iniciar esta rota.',
            started ? 'success' : 'warning'
          );
          return;
        }

        if (agvSimulator.currentRoute?.id === route.id) {
          this.showToast('Não é possível alterar uma rota em execução.', 'warning');
          return;
        }

        if (button.dataset.routeAction === 'edit') {
          this.editingRouteId = route.id;
          document.getElementById('routeNameInput').value = route.name;
          this.setRouteStops(route.waypoints);
          document.getElementById('routeModalTitle').textContent = `Editar rota: ${route.name}`;
          document.getElementById('routeSubmitButton').textContent = 'Guardar alterações';
          modalRoute.classList.add('open');
        } else if (button.dataset.routeAction === 'remove' && window.confirm(`Remover a rota "${route.name}"?`)) {
          const removed = store.removeRoute(route.id);
          this.showToast(removed ? 'Rota removida.' : 'Não foi possível remover a rota.', removed ? 'success' : 'error');
        }
      });
    }

    // Gestão de utilizadores na Administração.
    const btnNewUser = document.getElementById('btnNewUser');
    const modalUser = document.getElementById('modalUser');
    const formUser = document.getElementById('formUser');
    const usersTableBody = document.getElementById('usersTableBody');
    this.editingUserId = null;

    if (btnNewUser && modalUser) {
      btnNewUser.addEventListener('click', () => {
        this.editingUserId = null;
        formUser.reset();
        document.getElementById('userActive').value = 'true';
        document.getElementById('userModalTitle').textContent = 'Criar Utilizador';
        modalUser.classList.add('open');
      });
    }

    if (usersTableBody && modalUser) {
      usersTableBody.addEventListener('click', event => {
        const button = event.target.closest('button[data-user-action]');
        if (!button) return;
        const userId = button.dataset.userId;
        const user = store.getUsers().find(item => item.id === userId);
        if (!user) return;

        if (button.dataset.userAction === 'edit') {
          this.editingUserId = user.id;
          document.getElementById('userUsername').value = user.username;
          document.getElementById('userName').value = user.name;
          document.getElementById('userPassword').value = user.password;
          document.getElementById('userRole').value = user.role;
          document.getElementById('userActive').value = String(user.active);
          document.getElementById('userModalTitle').textContent = `Editar ${user.username}`;
          modalUser.classList.add('open');
        } else if (button.dataset.userAction === 'remove' && window.confirm(`Remover o utilizador ${user.username}?`)) {
          const removed = store.removeUser(user.id);
          this.showToast(removed ? 'Utilizador removido.' : 'Não foi possível remover o utilizador.', removed ? 'success' : 'error');
        }
      });
    }

    if (formUser && modalUser) {
      formUser.addEventListener('submit', event => {
        event.preventDefault();
        const username = document.getElementById('userUsername').value.trim().toLowerCase();
        const name = document.getElementById('userName').value.trim();
        const password = document.getElementById('userPassword').value;
        const role = document.getElementById('userRole').value;
        const active = document.getElementById('userActive').value === 'true';

        if (!username || !name || password.length < 6) {
          this.showToast('Preencha corretamente todos os campos e utilize uma palavra-passe com pelo menos 6 caracteres.', 'error');
          return;
        }

        const result = this.editingUserId
          ? store.updateUser(this.editingUserId, { username, name, password, role, active })
          : store.addUser({ username, name, password, role, active });

        if (!result && !this.editingUserId) {
          this.showToast('Já existe um utilizador com esse identificador.', 'error');
          return;
        }

        this.showToast(this.editingUserId ? 'Utilizador atualizado.' : 'Utilizador criado.', 'success');
        modalUser.classList.remove('open');
        formUser.reset();
        this.editingUserId = null;
      });
    }

    // Formulário de criação e edição do inventário de caixas.
    const btnNewBox = document.getElementById('btnNewBox');
    const modalBox = document.getElementById('modalBox');
    const formBox = document.getElementById('formBox');
    const boxesTableBody = document.getElementById('boxesTableBody');
    const boxIdInput = document.getElementById('boxIdInput');
    const boxIdLabel = document.getElementById('boxIdLabel');
    const boxRfidInput = document.getElementById('boxRfidInput');
    const boxModalTitle = document.getElementById('boxModalTitle');
    const boxSubmitButton = document.getElementById('boxSubmitButton');
    this.editingBoxId = null;

    if (btnNewBox && modalBox) {
      btnNewBox.addEventListener('click', () => {
        this.editingBoxId = null;
        formBox.reset();
        boxIdInput.readOnly = false;
        boxIdLabel.textContent = 'ID da Caixa';
        boxRfidInput.value = '';
        boxModalTitle.textContent = 'Registar Nova Caixa de Peças (Tag RFID)';
        boxSubmitButton.textContent = 'Guardar Caixa';
        modalBox.classList.add('open');
      });
    }

    // A delegação mantém os botões funcionais quando a tabela é redesenhada.
    if (boxesTableBody && modalBox) {
      boxesTableBody.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-box-action]');
        if (!button) return;

        const boxId = decodeURIComponent(button.dataset.boxId);
        if (button.dataset.boxAction === 'edit') {
          const box = store.getBoxes().find(item => item.id === boxId);
          if (!box) return;

          this.editingBoxId = box.id;
          // O ID é imutável para preservar as referências em tarefas e registos existentes.
          boxIdInput.value = box.id;
          boxIdInput.readOnly = true;
          boxIdLabel.textContent = 'ID da Caixa (não editável)';
          boxRfidInput.value = box.rfidTag;
          document.getElementById('boxDescInput').value = box.description;
          document.getElementById('boxContentInput').value = box.content;
          document.getElementById('boxLocationSelect').value = box.location;
          document.getElementById('boxWeightInput').value = box.weightKg;
          boxModalTitle.textContent = `Editar Caixa ${box.id}`;
          boxSubmitButton.textContent = 'Guardar Alterações';
          modalBox.classList.add('open');
          return;
        }

        // A store impede a remoção caso a caixa ainda esteja numa tarefa ativa.
        if (button.dataset.boxAction === 'remove' && window.confirm(`Remover a caixa ${boxId} do inventário?`)) {
          const removed = store.removeBox(boxId);
          this.showToast(
            removed ? `Caixa ${boxId} removida.` : 'Não é possível remover uma caixa associada a uma tarefa ativa.',
            removed ? 'success' : 'error'
          );
        }
      });
    }

    if (formBox) {
      formBox.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('boxIdInput').value.trim();
        const rfidTag = boxRfidInput.value.trim();
        const description = document.getElementById('boxDescInput').value.trim();
        const content = document.getElementById('boxContentInput').value.trim();
        const location = document.getElementById('boxLocationSelect').value;
        const weightKg = parseFloat(document.getElementById('boxWeightInput').value) || 5.0;
        const duplicateId = !this.editingBoxId && store.getBoxes().some(box => box.id === id);
        const duplicateRfid = rfidTag && store.getBoxes().some(box =>
          box.rfidTag === rfidTag && box.id !== this.editingBoxId
        );

        // Evita deixar caixas sem RFID ou reutilizar identificadores já registados.
        if (this.editingBoxId && !rfidTag) {
          this.showToast('A tag RFID é obrigatória ao editar uma caixa.', 'error');
          return;
        }

        if (duplicateId || duplicateRfid) {
          this.showToast(duplicateId ? 'Já existe uma caixa com esse ID.' : 'Essa tag RFID já está associada a outra caixa.', 'error');
          return;
        }

        // O mesmo formulário encaminha os dados para atualização ou criação.
        if (this.editingBoxId) {
          store.updateBox(this.editingBoxId, { rfidTag, description, content, location, weightKg });
          this.showToast(`Caixa ${id} atualizada com sucesso!`, 'success');
        } else {
          store.addBox({ id, rfidTag, description, content, location, weightKg });
          this.showToast(`Caixa ${id} registada com sucesso!`, 'success');
        }
        modalBox.classList.remove('open');
        formBox.reset();
        this.editingBoxId = null;
      });
    }

    // Botões para fechar modais
    document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
      });
    });
  }

  /**
   * Associa os controlos de emergência, joystick manual e testbed de hardware.
   */
  bindHardwareControls() {
    // Botões de Paragem de Emergência
    document.querySelectorAll('.btn-e-stop').forEach(btn => {
      btn.addEventListener('click', () => {
        if (agvSimulator.emergencyStopActive) {
          agvSimulator.clearEmergencyStop();
          apiClient.clearEmergencyStop();
          this.showToast('🟢 Emergência desativada. A tarefa foi retomada.', 'success');
        } else {
          agvSimulator.triggerEmergencyStop();
          apiClient.triggerEmergencyStop();
          this.showToast('🔴 PARAGEM DE EMERGÊNCIA ATIVADA!', 'error');
        }
      });
    });

    // Desbloqueio da Emergência
    const btnResetStop = document.getElementById('btnResetStop');
    if (btnResetStop) {
      btnResetStop.addEventListener('click', () => {
        agvSimulator.clearEmergencyStop();
        apiClient.clearEmergencyStop();
        this.showToast('🟢 AGV desbloqueado com sucesso.', 'success');
      });
    }

    // Parar carregamento somente quando a bateria tiver pelo menos 10%
    const btnStopCharging = document.getElementById('btnStopCharging');
    if (btnStopCharging) {
      btnStopCharging.addEventListener('click', () => {
        const stopped = agvSimulator.stopCharging();
        this.showToast(
          stopped
            ? '⏹️ Carregamento interrompido. O AGV pode mover agora.'
            : '⚠️ A bateria está abaixo de 10%. O carregamento não pode ser interrompido.',
          stopped ? 'success' : 'warning'
        );
      });
    }

    // Joystick Manual de Teleoperação
    document.querySelectorAll('.joy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const dir = btn.getAttribute('data-dir');
        if (!dir) return;

        if (!this.manualMovementConfirmed) {
          const confirmed = window.confirm(
            'O AGV será movido manualmente sem seguir uma rota definida e a tarefa atual poderá ser interrompida. ' +
            'Podem existir obstáculos no caminho. Certifique-se de que o percurso está livre e de que é seguro continuar. ' +
            'Deseja mover o AGV?'
          );
          if (!confirmed) return;
          this.manualMovementConfirmed = true;
        }

        agvSimulator.manualDrive(dir);
      });
    });

    // Testador de Conexão IP do ESP32
    const btnTestEsp = document.getElementById('btnTestEsp');
    if (btnTestEsp) {
      btnTestEsp.addEventListener('click', async () => {
        const ip = document.getElementById('espIpInput').value.trim();
        if (ip) {
          apiClient.setESP32IP(ip);
          const res = await apiClient.testConnection();
          if (res.success) {
            this.showToast(`Conectado ao ESP32 (${ip})`, 'success');
          } else {
            this.showToast(`Falha ao conectar a ${ip}`, 'warning');
          }
        }
      });
    }

    // Simulador de Leitura de Tag RFID
    const btnSimulateRfid = document.getElementById('btnSimulateRfid');
    if (btnSimulateRfid) {
      btnSimulateRfid.addEventListener('click', () => {
        const tag = document.getElementById('rfidTagInput').value.trim();
        if (tag) {
          const result = apiClient.simulateRFIDScan(tag);
          if (result) {
            this.showToast(`RFID Identificado: ${result.id} (${result.description})`, 'success');
          } else {
            this.showToast('Tag RFID não encontrada no sistema', 'error');
          }
        }
      });
    }

    // Limpar Histórico de Eventos
    const btnClearLogs = document.getElementById('btnClearLogs');
    if (btnClearLogs) {
      btnClearLogs.addEventListener('click', () => {
        store.clearLogs();
        this.showToast('Histórico de registos limpo.', 'info');
      });
    }

    // Exportação do Histórico para CSV
    const btnExportLogs = document.getElementById('btnExportLogs');
    if (btnExportLogs) {
      btnExportLogs.addEventListener('click', () => this.exportLogsCSV());
    }

    // Repor Dados de Fábrica
    const btnResetSystem = document.getElementById('btnResetSystem');
    if (btnResetSystem) {
      btnResetSystem.addEventListener('click', () => {
        if (confirm('Tem a certeza que deseja repor todas as definições e o estado do sistema?')) {
          store.resetToDefaults();
          this.showToast('Sistema reposto para os valores de fábrica com sucesso.', 'warning');
        }
      });
    }
  }

  /**
   * Preenche as caixas de seleção (Selects) do formulário de criação de tarefas com as caixas disponíveis e zonas existentes.
   */
  populateTaskFormSelects() {
    const boxSelect = document.getElementById('taskBoxSelect');
    const origSelect = document.getElementById('taskOriginSelect');
    const destSelect = document.getElementById('taskDestSelect');

    if (boxSelect) {
      const registeredBoxes = store.getBoxes();
      boxSelect.innerHTML = registeredBoxes.length > 0
        ? registeredBoxes.map(b =>
          `<option value="${b.id}">${b.id} — ${b.description} (${b.location})${b.status === 'disponivel' ? '' : ` — ${b.status}`}</option>`
        ).join('')
        : '<option value="">Nenhuma caixa registrada</option>';
    }

    const zones = store.state.zones;
    const zoneOptions = zones.map(z => `<option value="${z.code}">${z.name}</option>`).join('');
    
    if (origSelect) origSelect.innerHTML = zoneOptions;
    if (destSelect) destSelect.innerHTML = zoneOptions;
  }

  setRouteStops(waypoints = []) {
    const routeStopsList = document.getElementById('routeStopsList');
    routeStopsList.replaceChildren();
    (waypoints.length ? waypoints : ['', '']).forEach(code => this.addRouteStop(code));
  }

  addRouteStop(selectedCode = '') {
    const routeStopsList = document.getElementById('routeStopsList');
    const row = document.createElement('div');
    row.className = 'route-stop-row';

    const select = document.createElement('select');
    select.className = 'form-control';
    select.setAttribute('aria-label', `Paragem ${routeStopsList.children.length + 1}`);
    select.required = true;
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Selecionar zona';
    select.append(placeholder);

    store.state.zones.forEach(zone => {
      const option = document.createElement('option');
      option.value = zone.code;
      option.textContent = zone.name;
      select.append(option);
    });
    select.value = selectedCode;

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'btn btn-danger route-remove-stop';
    removeButton.title = 'Remover paragem';
    removeButton.setAttribute('aria-label', 'Remover paragem');
    removeButton.innerHTML = '<i class="ph-bold ph-trash"></i>';
    removeButton.addEventListener('click', () => row.remove());

    row.append(select, removeButton);
    routeStopsList.append(row);
  }

  /**
   * Atualiza dinamicamente todos os elementos do DOM da interface com base no estado atual da Store.
   */
  renderUI(state) {
    const agv = state.agv;
    const isAdministrator = this.isAdministrator();
    const createTaskButtons = [
      document.getElementById('btnNewTask'),
      document.getElementById('btnNewTaskManagement')
    ];
    createTaskButtons.forEach(button => {
      if (button) button.hidden = !isAdministrator;
    });

    document.querySelectorAll('.btn-e-stop').forEach(button => {
      const emergencyActive = agvSimulator.emergencyStopActive;
      const label = button.querySelector('span');
      if (label) label.textContent = emergencyActive ? 'DESATIVAR EMERGÊNCIA' : 'EMERGÊNCIA';
      button.setAttribute('aria-pressed', String(emergencyActive));
      button.title = emergencyActive
        ? 'Desativar a emergência e retomar a tarefa'
        : 'Parar imediatamente o AGV';
    });
    const btnResetStop = document.getElementById('btnResetStop');
    if (btnResetStop) btnResetStop.hidden = !agvSimulator.emergencyStopActive;
    document.querySelectorAll('.joy-btn[data-dir]').forEach(button => {
      button.disabled = agvSimulator.emergencyStopActive;
    });

    // 1. Badge de Estado da Barra Superior
    const statusBadge = document.getElementById('topStatusBadge');
    if (statusBadge) {
      statusBadge.className = `status-badge ${agv.status}`;
      const labels = {
        online: '🟢 AGV PRONTO / ONLINE',
        moving: '🔵 EM MOVIMENTO',
        prep: '🟡 EM PREPARAÇÃO',
        error: '🔴 ERRO / INTERROMPIDO',
        charging: '⚡ EM CARREGAMENTO'
      };
      statusBadge.innerHTML = labels[agv.status] || agv.status.toUpperCase();
    }

    // Medidor da Bateria
    const battMeter = document.getElementById('topBatteryFill');
    const battText = document.getElementById('topBatteryText');
    if (battMeter) battMeter.style.width = `${agv.battery}%`;
    if (battText) battText.innerText = `${agv.battery.toFixed(1)}%`;

    // 2. Indicador Rápido na Barra Lateral
    const sbDot = document.getElementById('sidebarAgvDot');
    const sbText = document.getElementById('sidebarAgvText');
    if (sbDot) sbDot.className = `agv-status-dot ${agv.status}`;
    if (sbText) sbText.innerText = `AGV: ${agv.location} (${agv.status})`;

    // 3. Controlo de carregamento e proteção de bateria
    const btnStopCharging = document.getElementById('btnStopCharging');
    if (btnStopCharging) {
      const normalizedLocation = String(agv.location || '').trim().toLowerCase();
      const isChargingZone = ['estação carga', 'estação de carga'].includes(normalizedLocation);
      const isLoading = agv.status === 'charging' && agv.battery < 100 && isChargingZone;
      const canStopCharging = isLoading && agv.battery >= 10;

      btnStopCharging.hidden = !isLoading;
      btnStopCharging.disabled = !canStopCharging;
      btnStopCharging.title = canStopCharging
        ? `Parar carregamento — bateria atual: ${agv.battery.toFixed(1)}%`
        : 'Disponível apenas durante o carregamento na estação de carga';
    }

    // 4. Cartões KPI de Métricas
    const kpiCompleted = document.getElementById('kpiTasksCompleted');
    const kpiActive = document.getElementById('kpiActiveTasks');
    const kpiBoxes = document.getElementById('kpiTotalBoxes');

    if (kpiCompleted) kpiCompleted.innerText = store.getTasks().filter(t => t.status === 'concluida').length;
    if (kpiActive) kpiActive.innerText = store.getTasks().filter(t => t.status === 'em_movimento' || t.status === 'preparacao' || t.status === 'aguardando').length;
    if (kpiBoxes) kpiBoxes.innerText = store.getBoxes().length;

    this.renderDonutChart(
      'taskStatusChart',
      'taskStatusLegend',
      'taskChartTotal',
      [
        { label: 'Concluídas', color: '#10B981', count: state.tasks.filter(task => task.status === 'concluida').length },
        { label: 'Em movimento', color: '#06B6D4', count: state.tasks.filter(task => task.status === 'em_movimento').length },
        { label: 'Em preparação', color: '#F59E0B', count: state.tasks.filter(task => task.status === 'preparacao').length },
        { label: 'Aguardando', color: '#818CF8', count: state.tasks.filter(task => task.status === 'aguardando').length },
        { label: 'Com erro', color: '#EF4444', count: state.tasks.filter(task => task.status === 'erro').length }
      ],
      'tarefas'
    );
    this.renderDonutChart(
      'boxStatusChart',
      'boxStatusLegend',
      'boxChartTotal',
      [
        { label: 'Disponíveis', color: '#10B981', count: state.boxes.filter(box => box.status === 'disponivel').length },
        { label: 'Em trânsito', color: '#06B6D4', count: state.boxes.filter(box => box.status === 'em_transito').length },
        { label: 'Entregues', color: '#818CF8', count: state.boxes.filter(box => box.status === 'entregue').length }
      ],
      'caixas'
    );

    // 4. Painel de Telemetria Detalhada
    const telLoc = document.getElementById('telLoc');

    if (telLoc) telLoc.innerText = agv.location;

    // 5. Renderização das Tabelas de Dados
    this.renderTasksTable(state.tasks);
    this.renderRoutesTable(state.routes);
    this.renderBoxesTable(state.boxes);
    this.renderUsersTable(state.users);
    this.renderLogsTable(state.logs);
  }

  renderDonutChart(chartId, legendId, totalId, entries, itemLabel) {
    const chart = document.getElementById(chartId);
    const legend = document.getElementById(legendId);
    const totalElement = document.getElementById(totalId);
    if (!chart || !legend || !totalElement) return;

    const total = entries.reduce((sum, entry) => sum + entry.count, 0);
    const dataSignature = entries.map(entry => entry.count).join(':');
    if (chart.dataset.chartValues === dataSignature) return;
    chart.dataset.chartValues = dataSignature;

    totalElement.textContent = total;
    chart.setAttribute(
      'aria-label',
      `${total} ${itemLabel}: ${entries.map(entry => `${entry.label} ${entry.count}`).join(', ')}`
    );

    let currentAngle = 0;
    const segments = entries
      .filter(entry => entry.count > 0)
      .map(entry => {
        const startAngle = currentAngle;
        currentAngle += entry.count / total * 360;
        return `${entry.color} ${startAngle}deg ${currentAngle}deg`;
      });
    chart.style.background = segments.length
      ? `conic-gradient(${segments.join(', ')})`
      : 'conic-gradient(#334155 0deg 360deg)';

    legend.replaceChildren();
    entries.forEach(entry => {
      const percentage = total ? Math.round(entry.count / total * 100) : 0;
      const item = document.createElement('li');
      const dot = document.createElement('span');
      dot.className = 'chart-legend-dot';
      dot.style.setProperty('--chart-color', entry.color);

      const label = document.createElement('span');
      label.textContent = entry.label;

      const value = document.createElement('span');
      value.className = 'chart-legend-value';
      value.textContent = `${entry.count} · ${percentage}%`;

      item.append(dot, label, value);
      legend.append(item);
    });
  }

  /**
   * Constrói a tabela de ordens de transporte com badges coloridas de estado.
   */
  renderTasksTable(tasks) {
    const tbody = document.getElementById('tasksTableBody');
    if (!tbody) return;

    if (tasks.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:var(--text-dim);">Nenhuma tarefa registada.</td></tr>';
      return;
    }

    const statusPills = {
      aguardando: '<span class="status-badge prep">🟡 Aguardando</span>',
      preparacao: '<span class="status-badge prep">🟡 Em preparação</span>',
      em_movimento: '<span class="status-badge moving">🔵 Em movimento</span>',
      concluida: '<span class="status-badge online">🟢 Concluída</span>',
      erro: '<span class="status-badge error">🔴 Erro / Interrompida</span>'
    };

    const canRunTask = this.isAuthenticated() &&
      store.state.agv.status === 'online' &&
      !agvSimulator.currentTask &&
      !agvSimulator.currentRoute &&
      !agvSimulator.emergencyStopActive;

    tbody.innerHTML = tasks.map(t => `
      <tr>
        <td class="mono"><strong>${t.id}</strong></td>
        <td><span class="mono">${t.boxId}</span></td>
        <td>${t.origin} ➔ ${t.destination}</td>
        <td>${statusPills[t.status] || t.status}</td>
        <td><span class="mono">${t.priority.toUpperCase()}</span></td>
        <td>${t.createdAt}</td>
        <td>${t.operator}</td>
        <td>
          ${t.status === 'aguardando' && this.isAuthenticated()
            ? `<button type="button" class="btn btn-primary" data-task-action="run" data-task-id="${t.id}" title="Executar tarefa pendente" aria-label="Executar tarefa ${t.id}" ${canRunTask ? '' : 'disabled'}>
                <i class="ph-bold ph-play"></i> Executar
              </button>`
            : '—'}
        </td>
      </tr>
    `).join('');
  }

  renderRoutesTable(routes) {
    const tbody = document.getElementById('routesTableBody');
    if (!tbody) return;
    if (routes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-dim);">Nenhuma rota predefinida.</td></tr>';
      return;
    }

    tbody.innerHTML = routes.map(route => {
      const isRunning = agvSimulator.currentRoute?.id === route.id;
      const safeName = this.escapeHTML(route.name);
      const safeWaypoints = this.escapeHTML(route.waypoints.join(' ➔ '));
      return `
        <tr>
          <td><strong>${safeName}</strong>${isRunning ? '<br><span class="status-badge moving">Em execução</span>' : ''}</td>
          <td class="mono">${route.waypoints.length}</td>
          <td>${safeWaypoints}</td>
          <td>
            <div class="box-actions">
              <button type="button" class="btn btn-primary" data-route-action="run" data-route-id="${route.id}" title="Executar rota" aria-label="Executar rota ${safeName}">
                <i class="ph-bold ph-play"></i>
              </button>
              <button type="button" class="btn btn-secondary" data-route-action="edit" data-route-id="${route.id}" title="Editar rota" aria-label="Editar rota ${safeName}" ${isRunning ? 'disabled' : ''}>
                <i class="ph-bold ph-pencil-simple"></i>
              </button>
              <button type="button" class="btn btn-danger" data-route-action="remove" data-route-id="${route.id}" title="Remover rota" aria-label="Remover rota ${safeName}" ${isRunning ? 'disabled' : ''}>
                <i class="ph-bold ph-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character]);
  }

  /**
   * Constrói a tabela do inventário de caixas e respetivas tags RFID.
   */
  renderUsersTable(users) {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    if (users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-dim);">Nenhum utilizador registado.</td></tr>`;
      return;
    }

    tbody.innerHTML = users.map(user => `
      <tr>
        <td class="mono"><strong>${user.username}</strong></td>
        <td>${user.name}</td>
        <td><span class="status-badge online">${user.role}</span></td>
        <td class="mono">${user.password}</td>
        <td><span class="status-badge ${user.active ? 'online' : 'error'}">${user.active ? 'Ativo' : 'Inativo'}</span></td>
        <td>
          <div class="box-actions">
            <button type="button" class="btn btn-secondary" data-user-action="edit" data-user-id="${user.id}" title="Editar utilizador" aria-label="Editar ${user.username}">
              <i class="ph-bold ph-pencil-simple"></i>
            </button>
            <button type="button" class="btn btn-danger" data-user-action="remove" data-user-id="${user.id}" title="Remover utilizador" aria-label="Remover ${user.username}">
              <i class="ph-bold ph-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  renderBoxesTable(boxes) {
    const tbody = document.getElementById('boxesTableBody');
    if (!tbody) return;

    if (boxes.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-dim);">Nenhuma caixa no inventário.</td></tr>`;
      return;
    }

    tbody.innerHTML = boxes.map(b => `
      <tr>
        <td class="mono"><strong>${b.id}</strong></td>
        <td><span class="mono" style="color:var(--accent-cyan);">${b.rfidTag}</span></td>
        <td><strong>${b.description}</strong><br><small style="color:var(--text-muted);">${b.content}</small></td>
        <td>${b.weightKg} kg</td>
        <td><span class="status-badge online">${b.location}</span></td>
        <td><span class="mono">${b.status}</span></td>
        <td>${b.lastUpdated}</td>
        <td>
          <div class="box-actions">
            <button type="button" class="btn btn-secondary" data-box-action="edit" data-box-id="${encodeURIComponent(b.id)}" title="Editar caixa" aria-label="Editar caixa ${b.id}">
              <i class="ph-bold ph-pencil-simple"></i>
            </button>
            <button type="button" class="btn btn-danger" data-box-action="remove" data-box-id="${encodeURIComponent(b.id)}" title="Remover caixa" aria-label="Remover caixa ${b.id}">
              <i class="ph-bold ph-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  /**
   * Constrói a tabela de registos históricos de auditoria.
   */
  renderLogsTable(logs) {
    const tbody = document.getElementById('logsTableBody');
    if (!tbody) return;

    if (logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--text-dim);">Histórico vazio.</td></tr>`;
      return;
    }

    const typeIcons = {
      info: 'ℹ️',
      success: '🟢',
      warning: '⚠️',
      error: '🔴'
    };

    tbody.innerHTML = logs.map(l => `
      <tr>
        <td class="mono" style="white-space:nowrap; color:var(--text-muted);">${l.timestamp}</td>
        <td style="width:40px; text-align:center;">${typeIcons[l.type] || '💬'}</td>
        <td>${l.message}</td>
      </tr>
    `).join('');
  }

  /**
   * Gera um ficheiro CSV descarregável com o histórico completo de operações.
   */
  exportLogsCSV() {
    const logs = store.state.logs;
    let csv = 'Timestamp,Tipo,Mensagem\n';
    logs.forEach(l => {
      csv += `"${l.timestamp}","${l.type}","${l.message.replace(/"/g, '""')}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ANDA_LA_Historico_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Apresenta uma notificação flutuante (Toast) no canto inferior direito.
   */
  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<div>${message}</div>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
}

// Inicializa a aplicação quando o modelo de documento HTML (DOM) estiver completamente carregado
document.addEventListener('DOMContentLoaded', () => {
  window.andaLaApp = new App();
});
