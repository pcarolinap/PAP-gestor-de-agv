const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const factoryConnections = [
  ['Zona A', 'Zona B'],
  ['Zona B', 'Zona D'],
  ['Zona D', 'Zona C'],
  ['Zona C', 'Zona B'],
  ['Zona C', 'Zona A'],
  ['Zona B', 'Estação Carga'],
  ['Zona C', 'Estação Carga'],
  ['Zona D', 'Estação Carga']
];

function loadSimulator(store, setTimeoutFn = setTimeout) {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'agv-simulator.js'),
    'utf8'
  )
    .replace("import { FACTORY_CONNECTIONS, store } from './store.js';", 'const FACTORY_CONNECTIONS = factoryConnectionsArgument; const store = storeArgument;')
    .replace('export const agvSimulator = new AGVSimulator();', 'const agvSimulator = new AGVSimulator();');

  const context = {
    storeArgument: store,
    factoryConnectionsArgument: factoryConnections,
    console,
    performance: { now: () => 0 },
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => {},
    setTimeout: setTimeoutFn,
    clearTimeout
  };
  vm.createContext(context);
  vm.runInContext(`${source}\nthis.agvSimulator = agvSimulator;`, context);
  return context.agvSimulator;
}

function createStore(initialState) {
  const updates = [];
  const store = {
    state: initialState,
    getTasks: () => initialState.tasks || [],
    updateAGV: (partial) => {
      updates.push(partial);
      initialState.agv = { ...initialState.agv, ...partial };
    },
    updateTaskStatus: (taskId, status) => {
      const task = initialState.tasks?.find(item => item.id === taskId);
      if (task) task.status = status;
    },
    updateBoxLocation: () => {},
    addLog: () => {},
    getBoxes: () => []
  };
  return { store, updates };
}

const state = {
  agv: {
    status: 'charging',
    location: 'Estação Carga',
    battery: 90,
    current: 1.4,
    speed: 0,
    x: 800,
    y: 120,
    angle: 0
  },
  zones: [{ code: 'Estação Carga', x: 800, y: 120 }],
  tasks: []
};
const { store } = createStore(state);
const simulator = loadSimulator(store);
simulator.updateAGVPhysics(1);

assert.equal(store.state.agv.status, 'charging');
assert.ok(store.state.agv.battery > 90, 'A bateria deve aumentar durante o carregamento.');
assert.equal(store.state.agv.current, -3.5);
assert.ok(store.state.agv.speed === 0);

const taskState = {
  agv: { status: 'moving', location: 'Zona C', battery: 45, current: 2.1, speed: 0.8 },
  zones: [{ code: 'Estação Carga', x: 800, y: 120 }],
  tasks: [{ id: 'TSK-CHARGE', boxId: 'BOX-001', destination: 'Estação Carga', status: 'em_movimento' }]
};
const taskStore = createStore(taskState);
const taskSimulator = loadSimulator(taskStore.store);
taskSimulator.zoneMap['Estação Carga'] = { x: 800, y: 120 };
taskSimulator.currentTask = taskState.tasks[0];
taskSimulator.waypoints = [];
taskSimulator.onPathComplete();

assert.equal(taskStore.store.state.agv.status, 'charging');
assert.equal(taskStore.store.state.agv.location, 'Estação Carga');
assert.equal(taskStore.store.state.agv.x, 800);
assert.equal(taskStore.store.state.agv.y, 120);
assert.equal(taskStore.store.state.agv.currentTaskId, null);
assert.deepEqual(taskSimulator.waypoints, []);
assert.equal(taskSimulator.waypointIndex, 0);

const stopStore = createStore({
  agv: { status: 'charging', battery: 10, current: -3.5, speed: 0 },
  zones: [{ code: 'Estação Carga', x: 800, y: 120 }],
  tasks: []
});
const stopSimulator = loadSimulator(stopStore.store);
assert.equal(stopSimulator.stopCharging(), true);
assert.equal(stopStore.store.state.agv.status, 'online');
assert.equal(stopStore.store.state.agv.speed, 0);

const blockedStore = createStore({
  agv: { status: 'charging', battery: 9.9, current: -3.5, speed: 0 },
  zones: [{ code: 'Estação Carga', x: 800, y: 120 }],
  tasks: []
});
const blockedSimulator = loadSimulator(blockedStore.store);
assert.equal(blockedSimulator.stopCharging(), false);
assert.equal(blockedStore.store.state.agv.status, 'charging');

const interruptedState = {
  agv: {
    status: 'charging',
    location: 'Estação Carga',
    battery: 75,
    current: -3.5,
    speed: 0,
    x: 800,
    y: 120
  },
  zones: [{ code: 'Estação Carga', x: 800, y: 120 }],
  tasks: []
};
const interruptedStore = createStore(interruptedState);
const interruptedSimulator = loadSimulator(interruptedStore.store);
assert.equal(interruptedSimulator.stopCharging(), true);
assert.equal(interruptedStore.store.state.agv.status, 'online');

interruptedSimulator.manualDrive('RIGHT');
interruptedStore.store.state.agv.x = 900;
interruptedStore.store.state.agv.y = 120;
interruptedSimulator.updateAGVPhysics(0.1);
assert.equal(interruptedStore.store.state.agv.status, 'online');
assert.equal(interruptedStore.store.state.agv.battery, 75);

interruptedStore.store.state.agv.x = 800;
interruptedStore.store.state.agv.y = 120;
interruptedSimulator.updateAGVPhysics(0.1);
assert.equal(interruptedStore.store.state.agv.status, 'charging');
assert.ok(interruptedStore.store.state.agv.battery > 75);

const normalZoneState = {
  agv: {
    status: 'online',
    location: 'Zona C',
    battery: 75,
    current: 0.2,
    speed: 0,
    x: 450,
    y: 380
  },
  zones: [
    { code: 'Estação Carga', x: 800, y: 120 },
    { code: 'Zona C', x: 450, y: 380 }
  ],
  tasks: []
};
const normalZoneStore = createStore(normalZoneState);
const normalZoneSimulator = loadSimulator(normalZoneStore.store);
normalZoneSimulator.updateAGVPhysics(0.1);
assert.equal(normalZoneStore.store.state.agv.status, 'online');
assert.equal(normalZoneStore.store.state.agv.battery, 75);

const staleLocationState = {
  agv: {
    status: 'charging',
    location: 'Estação Carga',
    battery: 75,
    current: -3.5,
    speed: 0,
    x: 450,
    y: 380
  },
  zones: [
    { code: 'Estação Carga', x: 800, y: 120 },
    { code: 'Zona C', x: 450, y: 380 }
  ],
  tasks: []
};
const staleLocationStore = createStore(staleLocationState);
const staleLocationSimulator = loadSimulator(staleLocationStore.store);
staleLocationSimulator.updateAGVPhysics(0.1);
assert.equal(staleLocationStore.store.state.agv.status, 'online');
assert.equal(staleLocationStore.store.state.agv.location, 'Zona C');
assert.equal(staleLocationStore.store.state.agv.battery, 75);

console.log('9 testes de carregamento, parada, retorno e zona normal passaram.');

const manualTakeoverTask = {
  id: 'TSK-MANUAL-TAKEOVER',
  boxId: 'BOX-TEST',
  origin: 'Zona A',
  destination: 'Zona D',
  status: 'aguardando'
};
const manualTakeoverState = {
  agv: {
    status: 'error', location: 'Zona A', battery: 75, current: 0.2, speed: 0,
    x: 120, y: 180, angle: 0, currentTaskId: manualTakeoverTask.id,
    carriedBoxId: manualTakeoverTask.boxId, sensorObstacle: true
  },
  zones: [
    { code: 'Estação Carga', x: 800, y: 120 },
    { code: 'Zona A', x: 120, y: 180 }
  ],
  tasks: [manualTakeoverTask]
};
const manualTakeoverStore = createStore(manualTakeoverState);
const manualTakeoverSimulator = loadSimulator(manualTakeoverStore.store);
manualTakeoverSimulator.currentTask = manualTakeoverTask;
manualTakeoverSimulator.waypoints = [{ x: 800, y: 380 }];
assert.equal(manualTakeoverSimulator.manualDrive('LEFT'), true);
assert.equal(manualTakeoverState.agv.x, 105);
assert.equal(manualTakeoverState.agv.status, 'online');
assert.equal(manualTakeoverState.agv.sensorObstacle, false);
assert.equal(manualTakeoverState.agv.currentTaskId, null);
assert.equal(manualTakeoverTask.status, 'erro');
assert.deepEqual(manualTakeoverSimulator.waypoints, []);

const alignedState = {
  agv: {
    status: 'moving', location: 'Zona A', battery: 75, current: 2.1, speed: 0.8,
    x: 120, y: 180, angle: Math.PI / 2
  },
  zones: [{ code: 'Zona B', x: 450, y: 120 }],
  tasks: []
};
const alignedStore = createStore(alignedState);
const alignedSimulator = loadSimulator(alignedStore.store);
alignedSimulator.waypoints = [{ x: 450, y: 120 }];
const initialDistance = Math.hypot(450 - alignedState.agv.x, 120 - alignedState.agv.y);
alignedSimulator.updateAGVPhysics(1 / 60);
assert.ok(
  Math.hypot(450 - alignedState.agv.x, 120 - alignedState.agv.y) < initialDistance,
  'O AGV deve aproximar-se do waypoint mesmo quando começa virado noutra direção.'
);

const factoryZones = [
  { code: 'Zona A', x: 120, y: 180 },
  { code: 'Zona B', x: 450, y: 120 },
  { code: 'Zona C', x: 450, y: 380 },
  { code: 'Zona D', x: 800, y: 380 },
  { code: 'Estação Carga', x: 800, y: 120 }
];

let sharedRouteState;
let sharedRouteSimulator;

[
  ['Zona A', 'Zona B'],
  ['Zona A', 'Zona C'],
  ['Zona A', 'Zona D'],
  ['Zona A', 'Estação Carga'],
  ['Zona B', 'Estação Carga'],
  ['Zona C', 'Zona D'],
  ['Zona D', 'Zona A']
].forEach(([originCode, destinationCode], index) => {
  const origin = factoryZones.find(zone => zone.code === originCode);
  const destination = factoryZones.find(zone => zone.code === destinationCode);
  const routeState = index === 0 ? {
    agv: {
      status: 'online', location: 'Zona A', battery: 80, current: 0.2,
      speed: 0, x: 120, y: 180, angle: 0
    },
    zones: factoryZones,
    tasks: []
  } : sharedRouteState;
  if (index === 0) sharedRouteState = routeState;
  const routeSimulator = index === 0 ? loadSimulator(createStore(routeState).store) : sharedRouteSimulator;
  if (index === 0) sharedRouteSimulator = routeSimulator;

  routeState.agv.status = 'moving';
  routeSimulator.currentTask = {
    id: `TEST-${originCode}-${destinationCode}`,
    boxId: 'BOX-TEST',
    origin: originCode,
    destination: destinationCode
  };
  routeSimulator.waypoints = routeSimulator.buildWaypoints([originCode, destinationCode], originCode);
  routeSimulator.waypointIndex = 0;

  let frames = 0;
  while (routeSimulator.currentTask && frames < 12000) {
    routeSimulator.updateAGVPhysics(1 / 60);
    frames++;
  }

  assert.equal(routeSimulator.currentTask, null, `${originCode} -> ${destinationCode} deve concluir`);
  assert.equal(routeState.agv.x, destination.x);
  assert.equal(routeState.agv.y, destination.y);
  assert.equal(
    routeState.agv.status,
    destinationCode === 'Estação Carga' ? 'charging' : 'online'
  );
});

const pathTestSimulator = loadSimulator(createStore({
  agv: { status: 'online', x: 120, y: 180, battery: 80, speed: 0 },
  zones: factoryZones,
  tasks: []
}).store);
assert.deepEqual(
  Array.from(pathTestSimulator.getShortestPath('Zona A', 'Zona D')),
  ['Zona A', 'Zona C', 'Zona D']
);
assert.deepEqual(
  Array.from(pathTestSimulator.getShortestPath('Zona D', 'Estação Carga')),
  ['Zona D', 'Estação Carga']
);
assert.deepEqual(
  Array.from(pathTestSimulator.getShortestPath('Zona C', 'Estação Carga')),
  ['Zona C', 'Estação Carga']
);

const resumedTask = {
  id: 'TSK-RESUME',
  boxId: 'BOX-023',
  origin: 'Zona A',
  destination: 'Estação Carga',
  status: 'em_movimento'
};
const resumedState = {
  agv: {
    status: 'charging', location: 'Estação Carga', battery: 80, current: -3.5,
    speed: 0, x: 777, y: 122, angle: -0.09, currentTaskId: resumedTask.id,
    carriedBoxId: resumedTask.boxId
  },
  zones: factoryZones,
  tasks: [resumedTask]
};
const resumedStore = createStore(resumedState);
const resumedSimulator = loadSimulator(resumedStore.store);
assert.equal(resumedStore.store.state.agv.status, 'moving');
assert.equal(resumedSimulator.currentTask, resumedTask);

let resumedFrames = 0;
while (resumedSimulator.currentTask && resumedFrames < 120) {
  resumedSimulator.updateAGVPhysics(1 / 60);
  resumedFrames++;
}
assert.equal(resumedSimulator.currentTask, null, 'a tarefa retomada deve atingir a estação');
assert.equal(resumedTask.status, 'concluida');
assert.equal(resumedStore.store.state.agv.status, 'charging');
assert.equal(resumedStore.store.state.agv.x, 800);
assert.equal(resumedStore.store.state.agv.y, 120);

const invalidRouteState = {
  agv: { status: 'moving', x: 120, y: 180, battery: 80, speed: 0.85 },
  zones: state.zones,
  tasks: []
};
const invalidRouteStore = createStore(invalidRouteState);
const invalidRouteSimulator = loadSimulator(invalidRouteStore.store);
invalidRouteSimulator.currentTask = { id: 'TSK-INVALID', boxId: 'BOX-TEST' };
invalidRouteSimulator.updateAGVPhysics(1 / 60);
assert.equal(invalidRouteState.agv.status, 'error');
assert.equal(invalidRouteSimulator.currentTask, null);
assert.deepEqual(invalidRouteSimulator.waypoints, []);

const emergencyStore = createStore({
  agv: { status: 'moving', x: 120, y: 180, battery: 80, speed: 0.85 },
  zones: state.zones,
  tasks: []
});
const emergencySimulator = loadSimulator(emergencyStore.store);
emergencySimulator.currentTask = { id: 'TSK-EMERGENCY', boxId: 'BOX-TEST' };
emergencySimulator.waypoints = [{ x: 450, y: 120 }];
emergencySimulator.triggerEmergencyStop();
assert.equal(emergencyStore.store.state.agv.status, 'error');
assert.equal(emergencyStore.store.state.agv.sensorObstacle, true);
assert.equal(emergencySimulator.currentTask.id, 'TSK-EMERGENCY');
assert.deepEqual(emergencySimulator.waypoints, [{ x: 450, y: 120 }]);
assert.equal(emergencySimulator.manualDrive('RIGHT'), false);
emergencySimulator.updateAGVPhysics(1 / 60);
assert.equal(emergencyStore.store.state.agv.x, 120, 'O AGV deve ficar parado durante a emergência.');
emergencySimulator.clearEmergencyStop();
assert.equal(emergencyStore.store.state.agv.status, 'moving');
assert.equal(emergencyStore.store.state.agv.sensorObstacle, false);
emergencySimulator.updateAGVPhysics(1 / 60);
assert.ok(emergencyStore.store.state.agv.x > 120, 'O AGV deve retomar a rota após desativar a emergência.');

const queuedCallbacks = [];
const queuedTask = {
  id: 'TSK-QUEUED',
  boxId: 'BOX-TEST',
  origin: 'Zona A',
  destination: 'Zona D',
  status: 'aguardando'
};
const queuedStore = createStore({
  agv: { status: 'online', x: 120, y: 180, battery: 80, speed: 0 },
  zones: factoryZones,
  tasks: [queuedTask]
});
const queuedSimulator = loadSimulator(
  queuedStore.store,
  callback => queuedCallbacks.push(callback)
);
queuedSimulator.updateAGVPhysics(1 / 60);
assert.equal(queuedTask.status, 'aguardando', 'Tarefas pendentes não devem iniciar automaticamente.');
assert.equal(queuedSimulator.currentTask, null);
assert.equal(queuedSimulator.dispatchTask(queuedTask), true, 'A tarefa deve iniciar quando solicitada manualmente.');
assert.equal(queuedTask.status, 'preparacao');
queuedCallbacks.forEach(callback => callback());
assert.equal(queuedTask.status, 'em_movimento');

const delayedCallbacks = [];
const pendingTask = {
  id: 'TSK-PREP-EMERGENCY',
  boxId: 'BOX-TEST',
  origin: 'Zona A',
  destination: 'Zona D',
  status: 'aguardando'
};
const pendingEmergencyStore = createStore({
  agv: { status: 'online', x: 120, y: 180, battery: 80, speed: 0 },
  zones: factoryZones,
  tasks: [pendingTask]
});
const pendingEmergencySimulator = loadSimulator(
  pendingEmergencyStore.store,
  callback => delayedCallbacks.push(callback)
);
pendingEmergencySimulator.dispatchTask(pendingTask);
pendingEmergencySimulator.triggerEmergencyStop();
delayedCallbacks.forEach(callback => callback());
assert.equal(pendingTask.status, 'preparacao');
assert.equal(pendingEmergencySimulator.currentTask, pendingTask);
assert.equal(pendingEmergencyStore.store.state.agv.status, 'error');
assert.ok(pendingEmergencySimulator.waypoints.length > 0);
pendingEmergencySimulator.clearEmergencyStop();
assert.equal(pendingTask.status, 'em_movimento');
assert.equal(pendingEmergencyStore.store.state.agv.status, 'moving');

console.log('7 rotas, retoma após recarregamento, falha sem waypoint e emergência passaram.');
