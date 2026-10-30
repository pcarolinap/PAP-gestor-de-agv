# ANDA LÁ — Autonomous Navigation & Delivery Assistant
## Sistema de Automação Logística & Gestão de Frota AGV (PAP - Prova de Aptidão Profissional)

![ANDA LÁ Status](https://img.shields.io/badge/Status-Funcional%20e%20Pronto-10B981?style=for-the-badge)
![Mecatrónica & Informática](https://img.shields.io/badge/Integra%C3%A7%C3%A3o-Mecatr%C3%B3nica%20%2B%20Inform%C3%A1tica-00F2FE?style=for-the-badge)

---

## 📌 Visão Geral do Projeto

O **ANDA LÁ** é um sistema integrado de automação industrial composto por um **AGV (Automated Guided Vehicle / Veículo Guiado Automatizado)** físico e por uma **Plataforma Web de Gestão e Monitorização em Tempo Real**.

O objetivo principal é substituir o transporte manual de caixas de componentes e peças em ambientes industriais (oficinas, armazéns, linhas de montagem), otimizando a eficiência e fornecendo rastreabilidade completa via **Tags RFID / Códigos QR**.

---

## 🏗️ Arquitetura do Sistema

```
 ┌─────────────────────────────────────────────────────────┐
 │               Aplicação Web (Frontend SPA)              │
 │  (Dashboard, Mapa 2D, Telemetria, Gestão de Tarefas)   │
 └────────────────────────────┬────────────────────────────┘
                              │
                              ▼
 ┌─────────────────────────────────────────────────────────┐
 │           Servidor / API REST (Node.js Express)         │
 │     (Processamento de dados, Histórico e Persistência)   │
 └────────────────────────────┬────────────────────────────┘
                              │
                  ┌───────────┴───────────┐
                  │  Comunicação Wi-Fi    │
                  ▼                       ▼
 ┌───────────────────────────┐ ┌───────────────────────────┐
 │   Módulo Físico ESP32     │ │   Motorização & Sensores  │
 │  (RFID, Sensores, Wi-Fi)  │ │ (Ultrassónico, Linha IR)  │
 └───────────────────────────┘ └───────────────────────────┘
```

---

## 💻 Componentes e Funcionalidades

### 1. Aplicação Web & Dashboard (Informática de Sistemas)
* **Dashboard Interativo**: Indicadores KPI em tempo real (Bateria %, Velocidade m/s, Tensão V, Tarefas Concluídas, Eficiência).
* **Visualizador de Mapa da Oficina 2D (HTML5 Canvas)**: Renderização vetorial do percurso do AGV em 60 FPS, zonas da fábrica (*Zona A - Receção*, *Zona B - Armazém*, *Zona C - Montagem*, *Zona D - Expedição*, *Estação de Carga*), leque do sensor Laser/LiDAR e animação da caixa transportada.
* **Gestão de Tarefas de Transporte**: Criação de ordens com seleção de Caixa, Origem, Destino e Prioridade. Transição de estados: `Aguardando` ➔ `Em preparação` ➔ `Em movimento` ➔ `Concluída`.
* **Inventário de Caixas & RFID**: Registador de caixas de peças com tags RFID únicos e especificações de peso/conteúdo.
* **Histórico Operacional & Registos**: Registo auditável de todas as viagens com botão de exportação para ficheiros **CSV**.
* **Paragem de Emergência & Teleoperação**: Joystick manual e botão de segurança para corte imediato de movimento.

### 2. Módulo de Mecatrónica & Hardware (ESP32)
* **Microcontrolador**: ESP32 Dual-Core com módulo Wi-Fi integrado.
* **Leitor RFID**: MFRC522 (SPI) para identificação automática das caixas ao carregar no AGV.
* **Motorização**: Driver Ponte-H L298N com motores DC e controlo PWM de velocidade.
* **Sensores de Navegação**: Sensor Ultrassónico HC-SR04 para deteção de obstáculos e sensores óticos infravermelhos (TCRT5000) para seguimento de linha.
* **Display OLED**: SSD1306 (I2C) no chassis para indicação do IP e estado do robô.

---

## 🚀 Como Executar o Projeto

### Opção A: Executar a aplicação Web localmente
Os módulos JavaScript ES6 precisam de ser servidos por HTTP; abrir `index.html` diretamente (`file://`) pode bloquear o carregamento da aplicação.

**No VS Code:** instalar a extensão **Live Server**, clicar com o botão direito em `index.html` e selecionar **Open with Live Server**.

**Em alternativa, com Python instalado:**
1. Abrir um terminal na pasta do projeto.
2. Iniciar um servidor HTTP local:
   ```bash
   py -m http.server 8000
   ```
   Em sistemas sem o comando `py`, utilizar `python -m http.server 8000`.
3. Abrir `http://localhost:8000` no navegador.

A aplicação funciona em **Modo de Simulação Autónoma Integrada** sem precisar do backend Node.js nem do ESP32.

### Opção B: Executar o Backend Server Node.js
```bash
cd server
npm install
npm start
```
O servidor REST API ficará acessível em `http://localhost:3000/api/status`.

### Opção C: Carregar Código no ESP32 (Equipa de Mecatrónica)
1. Abrir o ficheiro `hardware/esp32_anda_la.ino` no **Arduino IDE**.
2. Instalar as bibliotecas: `WiFi`, `HTTPClient`, `MFRC522`, `Adafruit_SSD1306`.
3. Configurar as credenciais Wi-Fi (`WIFI_SSID` e `WIFI_PASS`).
4. Fazer upload para a placa ESP32.

---

## 📑 Estrutura de Ficheiros

```
PAP/
├── index.html                  # Interface Principal SPA (HTML5)
├── css/
│   └── style.css               # Design System Industrial Dark Glassmorphism
├── js/
│   ├── app.js                  # Controlar Principal da Interface & Eventos
│   ├── store.js                # Gestão de Estado Persistente (IndexedDB/LocalStorage)
│   ├── agv-simulator.js        # Motor Físico de Navegação Autónoma do AGV
│   ├── factory-map.js          # Renderizador Canvas 2D do Mapa da Oficina
│   └── api-client.js           # Bridge de Comunicação com ESP32 / REST API
├── server/
│   ├── package.json            # Configuração Node.js
│   └── index.js                # Backend Server REST API & Express
├── hardware/
│   └── esp32_anda_la.ino       # Firmware C++/Arduino para o Módulo ESP32
└── README.md                   # Documentação Completa do Projeto
```

---

## 🏆 Créditos
Projeto desenvolvido no âmbito da **Prova de Aptidão Profissional (PAP)** dos Cursos Profissionais de **Informática de Sistemas** e **Mecatrónica**.
