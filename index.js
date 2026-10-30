/**
 * ANDA LÁ — Autonomous Navigation & Delivery Assistant — Backend Server
 * 
 * Servidor de API REST desenvolvido em Node.js com Express.
 * Responsável por receber pedidos da aplicação web e do microcontrolador ESP32,
 * gerir a persistência da base de dados e disponibilizar endpoints HTTP padronizados.
 */

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para permitir Cross-Origin Resource Sharing (CORS) entre a app web e a API
app.use(cors());

// Middleware para interpretar automaticamente pedidos com corpo em formato JSON
app.use(express.json());

// Base de Dados Simulada em Memória (Com estrutura pronta para migração para SQLite / PostgreSQL)
let db = {
  agv: {
    id: 'AGV-01',
    name: 'ANDA LÁ — Unit 01',
    status: 'online',
    battery: 88,
    voltage: 24.2,
    speed: 0.0,
    location: 'Zona A',
    rssi: -58,
    esp32Ip: '192.168.1.145'
  },
  boxes: [
    { id: 'BOX-023', rfidTag: 'E200-4106-9912-0023', description: 'Amortecedores Desportivos', location: 'Zona A', status: 'disponivel' },
    { id: 'BOX-024', rfidTag: 'E200-4106-9912-0024', description: 'ECU Módulos Controlo', location: 'Zona B', status: 'disponivel' }
  ],
  tasks: [
    { id: 'TSK-101', boxId: 'BOX-023', origin: 'Zona A', destination: 'Zona C', status: 'concluida', priority: 'alta' }
  ],
  logs: [
    { id: 'LOG-001', type: 'info', message: 'Servidor ANDA LÁ iniciado.', timestamp: new Date().toISOString() }
  ]
};

/**
 * 1. Health Check & Diagnóstico do Servidor
 * Endpoint: GET /api/status
 */
app.get('/api/status', (req, res) => {
  res.json({
    system: 'ANDA LÁ API Server',
    version: '1.0.0',
    status: 'ONLINE',
    timestamp: new Date().toISOString()
  });
});

/**
 * 2. Consulta e Atualização de Telemetria do AGV
 * Endpoints: GET /api/agv, PUT /api/agv/telemetry
 */
app.get('/api/agv', (req, res) => {
  res.json(db.agv);
});

app.put('/api/agv/telemetry', (req, res) => {
  db.agv = { ...db.agv, ...req.body };
  res.json({ success: true, agv: db.agv });
});

/**
 * 3. Gestão de Tarefas de Transporte
 * Endpoints: GET /api/tasks, POST /api/tasks, PUT /api/tasks/:id/status
 */
app.get('/api/tasks', (req, res) => {
  res.json(db.tasks);
});

app.post('/api/tasks', (req, res) => {
  const { boxId, origin, destination, priority } = req.body;
  const newTask = {
    id: `TSK-${Math.floor(100 + Math.random() * 900)}`,
    boxId,
    origin,
    destination,
    status: 'aguardando',
    priority: priority || 'normal',
    createdAt: new Date().toISOString()
  };
  db.tasks.unshift(newTask);
  res.status(201).json(newTask); // Código HTTP 201: Criado com Sucesso
});

app.put('/api/tasks/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const task = db.tasks.find(t => t.id === id);

  if (task) {
    task.status = status;
    res.json({ success: true, task });
  } else {
    res.status(404).json({ error: 'Tarefa não encontrada' });
  }
});

/**
 * 4. Gestão do Inventário de Caixas de Peças
 * Endpoints: GET /api/boxes, POST /api/boxes
 */
app.get('/api/boxes', (req, res) => {
  res.json(db.boxes);
});

app.post('/api/boxes', (req, res) => {
  const newBox = {
    id: req.body.id || `BOX-${Math.floor(100 + Math.random() * 900)}`,
    rfidTag: req.body.rfidTag || `RFID-${Math.floor(1000 + Math.random() * 9000)}`,
    description: req.body.description || 'Caixa Genérica',
    location: req.body.location || 'Zona A',
    status: 'disponivel'
  };
  db.boxes.unshift(newBox);
  res.status(201).json(newBox);
});

/**
 * 5. Receptor de Leituras Físicas de Tags RFID Enviadas pelo ESP32
 * Endpoint: POST /api/esp32/rfid
 */
app.post('/api/esp32/rfid', (req, res) => {
  const { tag } = req.body;
  const box = db.boxes.find(b => b.rfidTag === tag || b.id === tag);

  if (box) {
    db.logs.unshift({
      id: `LOG-${Date.now()}`,
      type: 'info',
      message: `ESP32 leu RFID: ${box.id} (${box.description})`,
      timestamp: new Date().toISOString()
    });
    res.json({ success: true, box });
  } else {
    res.status(404).json({ success: false, error: 'Tag RFID não cadastrada' });
  }
});

/**
 * 6. Comandos de navegação recebidos pelo ESP32
 */
app.post('/api/command', (req, res) => {
  const { action, taskId, origin, destination, boxId } = req.body || {};
  if (!action || !['NAVIGATE', 'EMERGENCY_STOP', 'STOP'].includes(action)) {
    return res.status(400).json({ success: false, error: 'Comando inválido.' });
  }

  db.logs.unshift({
    id: `LOG-${Date.now()}`,
    type: action === 'EMERGENCY_STOP' ? 'error' : 'info',
    message: `${action} recebido${taskId ? ` para ${taskId}` : ''}`,
    timestamp: new Date().toISOString()
  });

  return res.json({
    success: true,
    action,
    taskId,
    origin,
    destination,
    boxId
  });
});

/**
 * 7. Histórico de Registos do Sistema
 * Endpoint: GET /api/logs
 */
app.get('/api/logs', (req, res) => {
  res.json(db.logs);
});

// Inicializa a escuta no porto especificado
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 ANDA LÁ API Server a correr na porta ${PORT}`);
  console.log(`🔗 Endpoint: http://localhost:${PORT}/api/status`);
  console.log(`====================================================`);
});
