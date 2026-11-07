/* ==========================================================================
   ANDA LÁ — Autonomous Navigation & Delivery Assistant — Firmware ESP32
   Componente de Mecatrónica & Comunicação Informática
   
   Este código C++/Arduino é destinado a ser carregado no microcontrolador ESP32
   instalado fisicamente no chassis do AGV.
   Responsabilidades:
   1. Estabelecer e manter a ligação à rede Wi-Fi da oficina.
   2. Ler cartões/tags RFID através do leitor SPI MFRC522.
   3. Monitorizar a distância de segurança com o sensor ultrassónico HC-SR04.
   4. Controlar os motores DC via Ponte-H L298N usando sinais PWM.
   5. Apresentar o estado e IP atual no ecrã OLED I2C SSD1306.
   6. Enviar telemetria e leituras via requisições HTTP REST para a API Web.
   ========================================================================== */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WebServer.h>
#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// --------------------------------------------------------------------------
// Configuração de Rede Wi-Fi & URL do Servidor Central da API
// --------------------------------------------------------------------------
const char* WIFI_SSID = "OFICINA_WIFI";
const char* WIFI_PASS = "anda_la_2026";
const char* SERVER_URL = "http://192.168.1.100:3000/api";

// --------------------------------------------------------------------------
// Mapeamento de Pinos de Hardware — Mecatrónica (Motores & Sensores)
// --------------------------------------------------------------------------
// Pinos de Controlo do Driver de Motores DC (L298N Ponte-H)
#define ENA 13  // Habilitação e Controlo PWM de Velocidade do Motor A (Esquerdo)
#define IN1 12  // Direção de Rotação Motor A (Frente)
#define IN2 14  // Direção de Rotação Motor A (Trás)
#define IN3 27  // Direção de Rotação Motor B (Frente)
#define IN4 26  // Direção de Rotação Motor B (Trás)
#define ENB 25  // Habilitação e Controlo PWM de Velocidade do Motor B (Direito)

// Sensor Ultrassónico HC-SR04 para Deteção de Obstáculos à Frente
#define TRIG_PIN 5   // Pino emissor do pulso ultrassónico (Trigger)
#define ECHO_PIN 18  // Pino recetor do eco refletido (Echo)

// Sensores de Linha Óticos Infravermelhos (TCRT5000)
#define SENSOR_LINE_LEFT 32   // Sensor ótico esquerdo
#define SENSOR_LINE_RIGHT 33  // Sensor ótico direito

// Leitor de Tags RFID RC522 (Interface SPI)
#define SS_PIN 21   // Slave Select (SDA)
#define RST_PIN 22  // Reset Pin
MFRC522 rfid(SS_PIN, RST_PIN);

// Display Gráfico OLED I2C (SSD1306 128x64 píxeis)
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
WebServer esp32Server(80);

// Variáveis Globais do Estado de Telemetria
float batteryVoltage = 24.2;
String currentTaskState = "ONLINE";
bool navigationActive = false;
int navigationSpeed = 0;
bool emergencyStopActive = false;

/**
 * Função de Inicialização do Hardware e Periféricos do ESP32.
 */
void setup() {
  Serial.begin(115200);
  
  // Configuração dos Pinos dos Motores como Saídas Digitais
  pinMode(ENA, OUTPUT);
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT);
  pinMode(IN4, OUTPUT);
  pinMode(ENB, OUTPUT);

  // Configuração dos Pinos dos Sensores
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(SENSOR_LINE_LEFT, INPUT);
  pinMode(SENSOR_LINE_RIGHT, INPUT);

  // Inicializa o Ecrã OLED via barramento I2C (Endereço 0x3C)
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println(F("Falha ao inicializar o ecrã OLED SSD1306!"));
  } else {
    display.clearDisplay();
    display.setTextColor(WHITE);
    display.setTextSize(1);
    display.setCursor(0, 0);
    display.println("ANDA LA - AGV Unit 01");
    display.println("A ligar ao Wi-Fi...");
    display.display();
  }

  // Inicializa o Barramento SPI e o Leitor RFID MFRC522
  SPI.begin();
  rfid.PCD_Init();

  // Estabelece a Conexão à Rede Wi-Fi
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nConexão Wi-Fi Estabelecida!");
  Serial.print("Endereço IP atribuído ao ESP32: ");
  Serial.println(WiFi.localIP());
  esp32Server.on("/api/status", HTTP_GET, []() {
    String response = "{\"system\":\"ANDA LÁ ESP32\",\"status\":\"ONLINE\",\"hardware\":\"ESP32\"}";
    esp32Server.send(200, "application/json", response);
  });

  esp32Server.on("/api/command", HTTP_POST, []() {
    String command = esp32Server.arg("action");
    if (command.length() == 0) {
      command = esp32Server.arg(0);
    }

    if (command.indexOf("EMERGENCY_STOP") >= 0) {
      emergencyStopActive = true;
      stopMotors();
      esp32Server.send(200, "application/json", "{\"success\":true,\"action\":\"EMERGENCY_STOP\"}");
      return;
    }

    if (command.indexOf("EMERGENCY_CLEAR") >= 0) {
      emergencyStopActive = false;
      if (navigationActive) {
        moveForward(navigationSpeed);
      }
      esp32Server.send(200, "application/json", "{\"success\":true,\"action\":\"EMERGENCY_CLEAR\"}");
      return;
    }

    if (command.indexOf("NAVIGATE") >= 0) {
      navigationActive = true;
      navigationSpeed = 180;
      if (!emergencyStopActive) {
        moveForward(navigationSpeed);
      }
      esp32Server.send(200, "application/json", "{\"success\":true,\"action\":\"NAVIGATE\"}");
      return;
    }

    if (command.indexOf("STOP") >= 0) {
      stopMotors();
      navigationActive = false;
      esp32Server.send(200, "application/json", "{\"success\":true,\"action\":\"STOP\"}");
      return;
    }

    esp32Server.send(400, "application/json", "{\"success\":false,\"error\":\"Comando inválido\"}");
  });

  esp32Server.begin();  updateOLED("Wi-Fi OK", WiFi.localIP().toString());
}

/**
 * Loop Principal do Firmware (Executado continuamente).
 */
void loop() {
  // 1. Verificação de Leitura de Novas Tags RFID no Módulo MFRC522
  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    String rfidCode = "";
    // Converte a sequência de bytes do UID da tag RFID para uma string Hexadecimal
    for (byte i = 0; i < rfid.uid.size; i++) {
      rfidCode += String(rfid.uid.uidByte[i] < 0x10 ? "0" : "");
      rfidCode += String(rfid.uid.uidByte[i], HEX);
    }
    rfidCode.toUpperCase();
    Serial.println("Tag RFID Detetada: " + rfidCode);

    // Envia o código RFID lido para a API Web
    sendRFIDToServer(rfidCode);
    rfid.PICC_HaltA(); // Encerra a comunicação com a tag atual
  }

  // 2. Medição da Distância de Obstáculos em Tempo Real (Sensor Ultrassónico)
  long distance = readDistance();
  if (distance < 20 && distance > 0) { // Se detetar obstáculo a menos de 20cm
    stopMotors(); // Trava imediatamente os motores
    sendTelemetry("ERRO_OBSTACULO");
    updateOLED("AVISO OBSTACULO", String(distance) + " cm");
    delay(1000);
    return;
  }

  // 3. Envio Periódico de Telemetria de Estado para o Servidor Web (a cada 3 segundos)
  static unsigned long lastSend = 0;
  if (millis() - lastSend > 3000) {
    lastSend = millis();
    sendTelemetry("ONLINE");
  }

  delay(50);
}

// --------------------------------------------------------------------------
// Funções de Controlo Mecatrónico dos Motores e Sensores
// --------------------------------------------------------------------------

/**
 * Aciona os motores DC para a frente ajustando a velocidade PWM (0 a 255).
 */
void moveForward(int speedVal) {
  analogWrite(ENA, speedVal);
  analogWrite(ENB, speedVal);
  digitalWrite(IN1, HIGH);
  digitalWrite(IN2, LOW);
  digitalWrite(IN3, HIGH);
  digitalWrite(IN4, LOW);
}

/**
 * Paragem imediata de ambos os motores DC.
 */
void stopMotors() {
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW);
  digitalWrite(IN4, LOW);
}

/**
 * Calcula a distância até ao obstáculo em centímetros através do pulso de eco do sensor HC-SR04.
 * Fórmula: Distância (cm) = Tempo do Eco (µs) * Velocidade do Som (0.034 cm/µs) / 2
 */
long readDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 25000); // Timeout de 25ms se não houver eco
  if (duration == 0) return 999;
  return duration * 0.034 / 2;
}

/**
 * Envia um pacote JSON de telemetria para a API REST central via HTTP PUT.
 */
void sendTelemetry(String status) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(String(SERVER_URL) + "/api/agv/telemetry");
    http.addHeader("Content-Type", "application/json");

    String jsonPayload = "{\"id\":\"AGV-01\",\"status\":\"" + status + "\",\"battery\":88,\"voltage\":24.2}";
    int httpResponseCode = http.PUT(jsonPayload);
    http.end();
  }
}

/**
 * Notifica a API REST quando uma tag RFID é lida pelo leitor do AGV.
 */
void sendRFIDToServer(String tagCode) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(String(SERVER_URL) + "/api/esp32/rfid");
    http.addHeader("Content-Type", "application/json");

    String jsonPayload = "{\"tag\":\"" + tagCode + "\"}";
    int httpCode = http.POST(jsonPayload);
    http.end();
  }
}

/**
 * Atualiza o texto apresentado no ecrã OLED I2C do robô.
 */
void updateOLED(String line1, String line2) {
  display.clearDisplay();
  display.setCursor(0, 0);
  display.println("ANDA LA - AGV 01");
  display.println(line1);
  display.println(line2);
  display.display();
}
