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

### Opção A: Executar a aplicação Web com XAMPP
O login e a sessão do dashboard são tratados em PHP e precisam do Apache e MySQL do XAMPP; Live Server, Python `http.server` e abrir `index.php` diretamente não executam estes endpoints.

1. Colocar a pasta em `C:\xampp\htdocs\PAP-gestor-de-agv`.
2. Iniciar **Apache** e **MySQL** no XAMPP Control Panel.
3. Criar/configurar a base de dados `andala_pap` e a tabela `utilizadores` com as colunas `id`, `nome`, `email`, `password_hash` e `perfil`.
4. Criar cada conta na tabela com uma palavra-passe guardada como hash PHP (`password_hash`), nunca em texto simples.
5. Abrir `http://localhost/PAP-gestor-de-agv/login.html`.

O acesso ao dashboard só é concedido com uma sessão criada após validar a conta na base de dados. A interface do AGV mantém a simulação quando o ESP32 está desligado.

Na secção Administração, a consulta, criação, edição e remoção de utilizadores são processadas por `users.php`; apenas uma sessão de administrador pode gerir contas. As palavras-passe são armazenadas com `password_hash` e nunca são devolvidas à interface. O próprio utilizador autenticado não pode remover a sua conta.

### Opção B: Executar o Backend Server Node.js
```bash
cd C:\xampp\htdocs\PAP-gestor-de-agv
npm install
npm start
```
O servidor REST API ficará acessível em `http://localhost:3000/api/status`.

O backend e o frontend são processos separados. A interface funciona em modo de simulação sem o backend Node.js. O `test_db.php` apenas testa a ligação MySQL configurada em `config/db.php`; no XAMPP, iniciar o MySQL e criar a base de dados `andala_pap` antes de abrir `http://localhost/PAP-gestor-de-agv/test_db.php`.

### Opção C: Carregar Código no ESP32 (Equipa de Mecatrónica)
1. Abrir o ficheiro `hardware/esp32_anda_la.ino` no **Arduino IDE**.
2. Instalar as bibliotecas: `WiFi`, `HTTPClient`, `MFRC522`, `Adafruit_SSD1306`.
3. Configurar as credenciais Wi-Fi (`WIFI_SSID` e `WIFI_PASS`).
4. Fazer upload para a placa ESP32.

---

## 📑 Estrutura de Ficheiros

```
PAP-gestor-de-agv/
├── index.php                   # Interface principal protegida por sessão PHP
├── css/
│   ├── style.css               # Estilos da interface principal
│   └── login.css               # Estilos da página de acesso
├── app.js                      # Controlador principal da interface
├── store.js                    # Estado persistente (LocalStorage)
├── agv-simulator.js            # Simulador de navegação do AGV
├── factory-map.js              # Renderizador Canvas 2D do mapa
├── api-client.js               # Comunicação com o ESP32
├── index.js                    # Backend REST API Express
├── config/
│   └── db.php                  # Configuração MySQL do XAMPP
├── test_db.php                 # Teste da ligação MySQL
├── hardware/
│   └── esp32_anda_la.ino       # Firmware C++/Arduino para o Módulo ESP32
└── README.md                   # Documentação Completa do Projeto
```

---

## 🏆 Créditos
Projeto desenvolvido no âmbito da **Prova de Aptidão Profissional (PAP)** dos Cursos Profissionais de **Informática de Sistemas** e **Mecatrónica**.
