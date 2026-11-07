<?php
session_start();

// Se não existir uma sessão ativa, impede a entrada e reencaminha para o login
if (!isset($_SESSION['user_id'])) {
    header("Location: login.html");
    exit();
}
?>
<!DOCTYPE html>
<html lang="pt">
...
<!DOCTYPE html>
<html lang="pt">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ANDA LÁ — Autonomous Navigation & Delivery Assistant — Logistics Automation</title>

  <!-- Fontes do Google (Inter & JetBrains Mono) e Biblioteca de Ícones Phosphor -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link
    href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
    rel="stylesheet">
  <script src="https://unpkg.com/@phosphor-icons/web@2.0.3"></script>

  <!-- Folha de Estilos Principal (Design System Industrial Glassmorphic) -->
  <link rel="stylesheet" href="css/style.css">
</head>

<body>

  <!-- Estrutura Principal da Aplicação SPA -->
  <div id="app">
    
    <!-- Barra Lateral de Navegação (Menu de Vistas) -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="brand-icon">
          <i class="ph-bold ph-robot"></i>
        </div>
        <div class="brand-info">
          <h1>ANDALA</h1>
          <span> Autonomous Navigation & Delivery Assistant — Logistics Automation </span>
        </div>
      </div>

      <!-- Links de Navegação entre Vistas SPA -->
      <nav class="nav-menu">
        <a href="#" class="nav-item active" data-view="dashboard">
          <i class="ph-bold ph-squares-four"></i>
          <span>Dashboard</span>
        </a>
        <a href="#" class="nav-item" data-view="map">
          <i class="ph-bold ph-map-trifold"></i>
          <span>Mapa & Controlo</span>
        </a>
        <a href="#" class="nav-item" data-view="tasks">
          <i class="ph-bold ph-clipboard-text"></i>
          <span>Gestão Tarefas</span>
        </a>
        <a href="#" class="nav-item" data-view="boxes">
          <i class="ph-bold ph-package"></i>
          <span>Caixas & RFID</span>
        </a>
        <a href="#" class="nav-item" data-view="logs">
          <i class="ph-bold ph-clock-counter-clockwise"></i>
          <span>Histórico & Registos</span>
        </a>
        <a href="#" class="nav-item" data-view="hardware">
          <i class="ph-bold ph-cpu"></i>
          <span>Módulo Hardware</span>
        </a>
        <a href="#" class="nav-item" data-view="settings">
          <i class="ph-bold ph-gear-six"></i>
          <span>Administração</span>
        </a>
      </nav>

      <!-- Cartão de Estado Rápido na Rodapé da Sidebar -->
      <div class="sidebar-footer">
        <div class="agv-quick-card">
          <div id="sidebarAgvDot" class="agv-status-dot"></div>
          <div>
            <div id="sidebarAgvText" style="font-size:0.8rem; font-weight:700;">AGV: Online</div>
            <div style="font-size:0.7rem; color:var(--text-muted);">Unidade #01 (ESP32)</div>
          </div>
        </div>
      </div>
    </aside>

    <!-- Conteúdo Principal da Aplicação -->
    <main class="main-wrapper">
      
      <!-- Cabeçalho Superior com Indicadores de Telemetria e Paragem de Emergência -->
      <header class="top-bar">
        <div class="top-bar-title">
          <h2>Painel de Controlo Logístico</h2>
          <span id="topStatusBadge" class="status-badge online">🟢 AGV PRONTO / ONLINE</span>
        </div>

        <div class="top-bar-actions">
          <!-- Medidor do Nível de Bateria -->
          <div class="telemetry-pill">
            <i class="ph-bold ph-battery-charging" style="color:var(--status-online);"></i>
            <div class="battery-meter">
              <div id="topBatteryFill" class="battery-fill"></div>
            </div>
            <span id="topBatteryText" class="mono">88%</span>
          </div>

          <!-- Indicador de Intensidade de Sinal Wi-Fi (RSSI) -->
          <div class="telemetry-pill">
            <i class="ph-bold ph-wifi-high" style="color:var(--accent-cyan);"></i>
            <span class="mono">-58 dBm</span>
          </div>

          <!-- Botão de Paragem de Emergência Imediata -->
          <button class="btn btn-danger btn-e-stop">
            <i class="ph-bold ph-warning-octagon"></i>
            <span>EMERGÊNCIA</span>
          </button>

          <!-- Botão para abandonar a estação de carregamento somente com bateria suficiente -->
          <button id="btnStopCharging" class="btn btn-secondary stop-charging-btn" hidden disabled>
            <i class="ph-bold ph-stop"></i>
            <span>Parar carregamento</span>
          </button>
        </div>
      </header>

      <!-- Contentor das Vistas Alternáveis da SPA -->
      <div class="content-area">
        
        <!-- VISTA 1: DASHBOARD PRINCIPAL -->
        <section id="view-dashboard" class="page-view active">
          <div class="dashboard-grid">
            
            <!-- Cartões KPI com Métricas do Sistema -->
            <div class="panel kpi-card">
              <div class="kpi-icon green">
                <i class="ph-bold ph-check-circle"></i>
              </div>
              <div>
                <div id="kpiTasksCompleted" class="kpi-value mono">17</div>
                <div class="kpi-label">Tarefas Concluídas</div>
              </div>
            </div>

            <div class="panel kpi-card">
              <div class="kpi-icon amber">
                <i class="ph-bold ph-truck"></i>
              </div>
              <div>
                <div id="kpiActiveTasks" class="kpi-value mono">2</div>
                <div class="kpi-label">Tarefas em Fila / Movimento</div>
              </div>
            </div>

            <div class="panel kpi-card">
              <div class="kpi-icon cyan">
                <i class="ph-bold ph-package"></i>
              </div>
              <div>
                <div id="kpiTotalBoxes" class="kpi-value mono">4</div>
                <div class="kpi-label">Caixas Registadas</div>
              </div>
            </div>

            <div class="panel kpi-card">
              <div class="kpi-icon indigo">
                <i class="ph-bold ph-pulse"></i>
              </div>
              <div>
                <div class="kpi-value mono">99.4%</div>
                <div class="kpi-label">Eficiência Operacional</div>
                <a class="kpi-more-link" href="#dashboardCharts">
                  Ver mais <i class="ph-bold ph-arrow-down"></i>
                </a>
              </div>
            </div>

            <!-- Painel do Mapa da Fábrica (HTML5 Canvas Engine) -->
            <div class="panel map-panel">
              <div class="panel-header">
                <div class="panel-title">
                  <i class="ph-bold ph-map-pin-line"></i> Visualizador da Oficina & AGV em Tempo Real
                </div>
                <button id="btnNewTask" class="btn btn-primary" hidden>
                  <i class="ph-bold ph-plus-circle"></i> Nova Tarefa de Transporte
                </button>
              </div>

              <!-- Elemento Canvas 2D renderizado a 60 FPS -->
              <div class="canvas-container">
                <canvas id="factoryCanvas"></canvas>
              </div>
            </div>

            <!-- Painel de Telemetria e Teleoperação por Joystick -->
            <div class="panel telemetry-panel">
              <div class="panel-header">
                <div class="panel-title">
                  <i class="ph-bold ph-gauge"></i> Telemetria do AGV
                </div>
              </div>

              <!-- Localização atual do AGV -->
              <div class="stat-grid">
                <div class="stat-box">
                  <div class="label">Localização Atual</div>
                  <div id="telLoc" class="value mono">Zona A</div>
                </div>
              </div>

              <!-- Comandos de Joystick para Teleoperação Manual -->
              <div style="margin-top:12px;">
                <div class="panel-title" style="font-size:0.9rem; margin-bottom:10px;">
                  <i class="ph-bold ph-game-controller"></i> Teleoperação Manual Direta
                </div>
                <div class="joystick-grid">
                  <div></div>
                  <button class="joy-btn" data-dir="UP"><i class="ph-bold ph-caret-up"></i></button>
                  <div></div>
                  <button class="joy-btn" data-dir="LEFT"><i class="ph-bold ph-caret-left"></i></button>
                  <button id="btnResetStop" class="joy-btn" style="color:var(--status-online);"><i
                      class="ph-bold ph-arrows-counter-clockwise"></i></button>
                  <button class="joy-btn" data-dir="RIGHT"><i class="ph-bold ph-caret-right"></i></button>
                  <div></div>
                  <button class="joy-btn" data-dir="DOWN"><i class="ph-bold ph-caret-down"></i></button>
                  <div></div>
                </div>
              </div>
            </div>

            <div class="panel dashboard-charts-panel" id="dashboardCharts">
              <div class="panel-header">
                <div class="panel-title">
                  <i class="ph-bold ph-chart-donut"></i> Indicadores Operacionais
                </div>
              </div>
              <div class="dashboard-charts-grid">
                <section class="dashboard-chart-card" aria-labelledby="taskChartTitle">
                  <h3 id="taskChartTitle">Estado das Tarefas</h3>
                  <div class="donut-chart" id="taskStatusChart" role="img" aria-label="Estado das tarefas">
                    <div class="donut-chart-center">
                      <strong id="taskChartTotal">0</strong>
                      <span>tarefas</span>
                    </div>
                  </div>
                  <ul class="chart-legend" id="taskStatusLegend"></ul>
                </section>
                <section class="dashboard-chart-card" aria-labelledby="boxChartTitle">
                  <h3 id="boxChartTitle">Estado do Inventário</h3>
                  <div class="donut-chart" id="boxStatusChart" role="img" aria-label="Estado das caixas">
                    <div class="donut-chart-center">
                      <strong id="boxChartTotal">0</strong>
                      <span>caixas</span>
                    </div>
                  </div>
                  <ul class="chart-legend" id="boxStatusLegend"></ul>
                </section>
              </div>
            </div>

          </div>
        </section>

        <!-- VISTA 2: MAPA EXPANDIDO DE NAVEGAÇÃO -->
        <section id="view-map" class="page-view">
          <div class="panel">
            <div class="panel-header">
              <div class="panel-title">
                <i class="ph-bold ph-compass"></i> Navegação Autónoma & Trajetória em Tempo Real
              </div>
            </div>
            <div class="canvas-container" style="height: min(62vh, 680px); min-height: 420px;">
              <canvas id="factoryCanvasMap"></canvas>
            </div>
          </div>

          <div class="panel map-routes-panel">
            <div class="panel-header">
              <div class="panel-title">
                <i class="ph-bold ph-path"></i> Rotas Predefinidas
              </div>
              <button id="btnNewRoute" class="btn btn-primary">
                <i class="ph-bold ph-plus-circle"></i> Criar rota
              </button>
            </div>
            <div class="data-table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Rota</th>
                    <th>Paragens</th>
                    <th>Percurso</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody id="routesTableBody"></tbody>
              </table>
            </div>
          </div>
        </section>

        <!-- VISTA 3: GESTÃO DE TAREFAS DE TRANSPORTE -->
        <section id="view-tasks" class="page-view">
          <div class="panel">
            <div class="panel-header">
              <div class="panel-title">
                <i class="ph-bold ph-clipboard-text"></i> Ordens de Transporte & Gestão de Tarefas
              </div>
              <button id="btnNewTaskManagement" class="btn btn-primary admin-task-control" hidden>
                <i class="ph-bold ph-plus-circle"></i> Criar tarefa pendente
              </button>
            </div>

            <div class="data-table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>ID Tarefa</th>
                    <th>Caixa</th>
                    <th>Percurso (Origem ➔ Destino)</th>
                    <th>Estado</th>
                    <th>Prioridade</th>
                    <th>Data / Hora</th>
                    <th>Operador</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody id="tasksTableBody">
                  <!-- Linhas preenchidas dinamicamente via JS -->
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <!-- VISTA 4: INVENTÁRIO DE CAIXAS & RFID -->
        <section id="view-boxes" class="page-view">
          <div class="panel">
            <div class="panel-header">
              <div class="panel-title">
                <i class="ph-bold ph-package"></i> Inventário de Caixas de Peças & Tags RFID
              </div>
              <button id="btnNewBox" class="btn btn-secondary">
                <i class="ph-bold ph-plus"></i> Registar Nova Caixa
              </button>
            </div>

            <div class="data-table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>ID Caixa</th>
                    <th>Tag RFID / QR</th>
                    <th>Descrição & Conteúdo</th>
                    <th>Peso</th>
                    <th>Localização Atual</th>
                    <th>Estado</th>
                    <th>Última Atualização</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody id="boxesTableBody">
                  <!-- Linhas preenchidas dinamicamente via JS -->
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <!-- VISTA 5: HISTÓRICO & REGISTOS DE AUDITORIA -->
        <section id="view-logs" class="page-view">
          <div class="panel">
            <div class="panel-header">
              <div class="panel-title">
                <i class="ph-bold ph-clock-counter-clockwise"></i> Histórico Completo de Operações & Erros
              </div>
              <div style="display:flex; gap:10px;">
                <button id="btnExportLogs" class="btn btn-secondary">
                  <i class="ph-bold ph-download-simple"></i> Exportar CSV
                </button>
                <button id="btnClearLogs" class="btn btn-secondary" style="color:var(--status-error);">
                  <i class="ph-bold ph-trash"></i> Limpar Histórico
                </button>
              </div>
            </div>

            <div class="data-table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Data / Hora</th>
                    <th>Tipo</th>
                    <th>Descrição do Evento / Operação</th>
                  </tr>
                </thead>
                <tbody id="logsTableBody">
                  <!-- Linhas preenchidas dinamicamente via JS -->
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <!-- VISTA 6: MÓDULO DE HARDWARE ESP32 & CONEXÃO REST API -->
        <section id="view-hardware" class="page-view">
          <div class="dashboard-grid">
            
            <!-- Testador de Ligação IP do ESP32 -->
            <div class="panel" style="grid-column: span 6;">
              <div class="panel-header">
                <div class="panel-title">
                  <i class="ph-bold ph-cpu"></i> Configuração de Conexão ESP32 (Wi-Fi / REST API)
                </div>
              </div>

              <div class="form-group">
                <label>Endereço IP do Módulo ESP32 no AGV</label>
                <input type="text" id="espIpInput" class="form-control mono" value="192.168.1.145">
              </div>

              <button id="btnTestEsp" class="btn btn-primary">
                <i class="ph-bold ph-plugs-connected"></i> Testar Conexão REST API
              </button>
            </div>

            <!-- Testbed de Leitura de Tag RFID -->
            <div class="panel" style="grid-column: span 6;">
              <div class="panel-header">
                <div class="panel-title">
                  <i class="ph-bold ph-broadcast"></i> Testbed de Leitura de Tag RFID
                </div>
              </div>

              <div class="form-group">
                <label>Código da Tag RFID / ID da Caixa a Simular</label>
                <input type="text" id="rfidTagInput" class="form-control mono" value="E200-4106-9912-0023"
                  placeholder="Insira o código RFID...">
              </div>

              <button id="btnSimulateRfid" class="btn btn-secondary">
                <i class="ph-bold ph-scan"></i> Simular Leitura RFID do ESP32
              </button>
            </div>
          </div>
        </section>

        <!-- VISTA 7: ADMINISTRAÇÃO & DEFINIÇÕES DO SISTEMA -->
        <section id="view-settings" class="page-view">
          <div class="dashboard-grid">
            <div class="panel" style="grid-column: span 6;">
              <div class="panel-header">
                <div class="panel-title">
                  <i class="ph-bold ph-shield-check"></i> Parâmetros Operacionais da Frota
                </div>
              </div>
              <div class="form-group">
                <label>Velocidade Máxima do AGV (m/s)</label>
                <input type="number" class="form-control mono" value="1.2" step="0.1" min="0.2" max="2.0">
              </div>
              <div class="form-group">
                <label>Modo de Navegação por Defeito</label>
                <select class="form-control">
                  <option value="line">Seguidor de Linha Indutivo + RFID (Modo Híbrido)</option>
                  <option value="slam">Navegação Autónoma SLAM LiDAR</option>
                  <option value="manual">Teleoperação Manual por Controlo Remoto</option>
                </select>
              </div>
              <div class="form-group">
                <label>Limite Crítico de Bateria para Recarga Autónoma (%)</label>
                <input type="number" class="form-control mono" value="20" min="5" max="50">
              </div>
              <button class="btn btn-primary" onclick="alert('Definições guardadas com sucesso!')">
                <i class="ph-bold ph-floppy-disk"></i> Guardar Configurações
              </button>
            </div>

            <div class="panel" style="grid-column: span 6;">
              <div class="panel-header">
                <div class="panel-title">
                  <i class="ph-bold ph-user-gear"></i> Perfil & Credenciais de Acesso
                </div>
              </div>
              <div class="form-group">
                <label>Utilizador Atual</label>
                <input type="text" class="form-control" value="Eng. Mecatrónica / Informática (Admin)" disabled>
              </div>
              <div class="form-group">
                <label>Nível de Permissão</label>
                <input type="text" class="form-control mono" value="ADMINISTRADOR_TOTAL" disabled>
              </div>
              <div class="form-group" style="margin-top:20px;">
                <button id="btnResetSystem" class="btn btn-secondary" style="color:var(--status-prep); border-color:rgba(245,158,11,0.3);">
                  <i class="ph-bold ph-arrows-counter-clockwise"></i> Repor Dados de Fábrica (Reset State)
                </button>
              </div>
            </div>

            <div class="panel" style="grid-column: span 12;">
              <div class="panel-header">
                <div class="panel-title">
                  <i class="ph-bold ph-users"></i> Utilizadores Registrados
                </div>
                <button id="btnNewUser" class="btn btn-primary">
                  <i class="ph-bold ph-plus"></i> Novo Utilizador
                </button>
              </div>
              <div class="data-table-container">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Utilizador</th>
                      <th>Nome</th>
                      <th>Cargo</th>
                      <th>Estado</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody id="usersTableBody"></tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

      </div>
    </main>
  </div>

  <!-- MODAL: GESTÃO DE UTILIZADORES -->
  <div id="modalUser" class="modal-backdrop">
    <div class="modal">
      <div class="modal-header">
        <h3 id="userModalTitle">Criar Utilizador</h3>
        <button class="modal-close" type="button" aria-label="Fechar">&times;</button>
      </div>
      <form id="formUser">
        <div class="form-group">
          <label for="userUsername">Identificador de acesso</label>
          <input id="userUsername" class="form-control" type="email" autocomplete="username" required>
        </div>
        <div class="form-group">
          <label for="userName">Nome do utilizador</label>
          <input id="userName" class="form-control" type="text" required>
        </div>
        <div class="form-group">
          <label for="userPassword">Palavra-passe</label>
          <input id="userPassword" class="form-control" type="password" minlength="6" required>
        </div>
        <div class="form-group">
          <label for="userRole">Cargo</label>
          <select id="userRole" class="form-control">
            <option value="Operador">Operador</option>
            <option value="Supervisor">Supervisor</option>
            <option value="Administrador">Administrador</option>
          </select>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
          <button type="button" class="btn btn-secondary modal-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar Utilizador</button>
        </div>
      </form>
    </div>
  </div>

  <!-- MODAL: NOVA TAREFA DE TRANSPORTE -->
  <div id="modalTask" class="modal-backdrop">
    <div class="modal">
      <div class="modal-header">
        <h3 id="taskModalTitle">Criar Nova Tarefa de Transporte</h3>
        <button class="modal-close">&times;</button>
      </div>

      <form id="formTask">
        <div class="form-group">
          <label for="taskActionSelect">O que pretende fazer?</label>
          <select id="taskActionSelect" class="form-control">
            <option value="pending">Guardar como pendente</option>
            <option value="execute">Criar e executar agora</option>
            <option value="predefined">Executar rota predefinida</option>
          </select>
        </div>

        <div id="transportTaskFields" class="task-option-fields">
          <div class="form-group">
          <label>Selecionar Caixa de Peças</label>
          <select id="taskBoxSelect" class="form-control"></select>
          </div>

          <div class="form-group">
          <label>Ponto de Origem</label>
          <select id="taskOriginSelect" class="form-control"></select>
          </div>

          <div class="form-group">
          <label>Ponto de Destino</label>
          <select id="taskDestSelect" class="form-control"></select>
          </div>

          <div class="form-group">
          <label>Prioridade da Tarefa</label>
          <select id="taskPrioritySelect" class="form-control">
            <option value="normal">Normal</option>
            <option value="alta">Alta (Urgente)</option>
          </select>
          </div>
        </div>

        <div id="predefinedRouteFields" class="form-group task-option-fields" hidden>
          <label for="taskRouteSelect">Selecionar rota predefinida</label>
          <select id="taskRouteSelect" class="form-control"></select>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
          <button type="button" class="btn btn-secondary modal-cancel">Cancelar</button>
          <button id="taskSubmitButton" type="submit" class="btn btn-primary">Guardar como pendente</button>
        </div>
      </form>
    </div>
  </div>

  <!-- MODAL: CRIAR E EDITAR ROTAS PREDEFINIDAS -->
  <div id="modalRoute" class="modal-backdrop">
    <div class="modal">
      <div class="modal-header">
        <h3 id="routeModalTitle">Criar rota predefinida</h3>
        <button class="modal-close" type="button" aria-label="Fechar">&times;</button>
      </div>
      <form id="formRoute">
        <div class="form-group">
          <label for="routeNameInput">Nome da rota</label>
          <input id="routeNameInput" class="form-control" type="text" maxlength="60" required>
        </div>
        <div class="form-group">
          <label>Paragens pela ordem de passagem</label>
          <div id="routeStopsList" class="route-stops-list"></div>
          <button id="btnAddRouteStop" type="button" class="btn btn-secondary route-add-stop">
            <i class="ph-bold ph-plus"></i> Adicionar paragem
          </button>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
          <button type="button" class="btn btn-secondary modal-cancel">Cancelar</button>
          <button id="routeSubmitButton" type="submit" class="btn btn-primary">Guardar rota</button>
        </div>
      </form>
    </div>
  </div>

  <!-- MODAL: REGISTAR NOVA CAIXA (TAG RFID) -->
  <div id="modalBox" class="modal-backdrop">
    <div class="modal">
      <div class="modal-header">
        <h3 id="boxModalTitle">Registar Nova Caixa de Peças (Tag RFID)</h3>
        <button class="modal-close">&times;</button>
      </div>

      <form id="formBox">
        <div class="form-group">
          <label id="boxIdLabel">ID da Caixa</label>
          <input type="text" id="boxIdInput" class="form-control mono" placeholder="ex: BOX-027" required>
        </div>

        <div class="form-group">
          <label>Tag RFID</label>
          <input type="text" id="boxRfidInput" class="form-control mono" placeholder="Gerada automaticamente se ficar vazia">
        </div>

        <div class="form-group">
          <label>Descrição do Componente</label>
          <input type="text" id="boxDescInput" class="form-control" placeholder="ex: Módulo Direção Assistida" required>
        </div>

        <div class="form-group">
          <label>Conteúdo Detalhado</label>
          <input type="text" id="boxContentInput" class="form-control" placeholder="ex: 2x Bombas Hidráulicas" required>
        </div>

        <div class="form-group">
          <label>Localização Inicial</label>
          <select id="boxLocationSelect" class="form-control">
            <option value="Zona A">Zona A — Receção</option>
            <option value="Zona B">Zona B — Armazém</option>
            <option value="Zona C">Zona C — Montagem</option>
            <option value="Zona D">Zona D — Expedição</option>
          </select>
        </div>

        <div class="form-group">
          <label>Peso Estimado (kg)</label>
          <input type="number" id="boxWeightInput" class="form-control" value="10.0" step="0.5" required>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
          <button type="button" class="btn btn-secondary modal-cancel">Cancelar</button>
          <button id="boxSubmitButton" type="submit" class="btn btn-primary">Guardar Caixa</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Contentor para Notificações Flutuantes (Toast Notifications) -->
  <div id="toastContainer"></div>

  <!-- Carregamento dos Módulos JavaScript ES6 -->
  <script type="module" src="app.js?v=4"></script>
</body>

</html>