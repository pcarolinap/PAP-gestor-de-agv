/**
 * ANDA LÁ — API Client & ESP32 Hardware Communication Bridge
 * 
 * Este módulo faz a ligação de comunicação entre o sistema informático web e o hardware físico.
 * Permite comunicar com o microcontrolador ESP32 através de pedidos HTTP REST e WebSockets,
 * tratando automaticamente situações de timeout ou perda de ligação ao comutar suavemente
 * para o motor de simulação autónomo interno.
 */

import { store } from './store.js';

export class APIClient {
  constructor() {
    this.esp32Ip = store.state.agv.esp32Ip;
    this.pollInterval = null;
    this.isConnected = false;
  }

  /**
   * Atualiza o endereço IP alvo do módulo ESP32 instalado no chassis do AGV.
   */
  setESP32IP(ip) {
    this.esp32Ip = ip;
    store.updateAGV({ esp32Ip: ip });
  }

  /**
   * Testa a conectividade com o módulo ESP32 físico via pedido HTTP GET com timeout de 2 segundos.
   */
  async testConnection() {
    try {
      const response = await fetch(`http://${this.esp32Ip}/api/status`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000) // Cancela o pedido se o ESP32 não responder em 2 segundos
      });
      if (response.ok) {
        const data = await response.json();
        this.isConnected = true;
        store.updateAGV({ hardwareConnected: true });
        store.addLog('success', `Conexão bem-sucedida ao módulo ESP32 hardware em ${this.esp32Ip}`);
        return { success: true, data };
      }
    } catch (e) {
      // Se o ESP32 não responder (offline), ativa automaticamente o modo de simulação no navegador
      this.isConnected = false;
      store.updateAGV({ hardwareConnected: false });
      store.addLog('warning', `ESP32 físico não encontrado em ${this.esp32Ip}. Módulo a funcionar em modo de Simulação Integrada.`);
      return { success: false, error: 'Connection Timeout / Hardware Offline' };
    }
  }

  /**
   * Envia uma ordem de transporte para execução pelo ESP32 ou redireciona para o simulador interno.
   */
  async sendTaskToESP32(task) {
    if (!this.isConnected) {
      console.log('Enviando tarefa para o motor de simulação interno:', task);
      return { success: true, mode: 'simulated' };
    }

    try {
      const params = new URLSearchParams({
        action: 'NAVIGATE',
        taskId: task.id,
        origin: task.origin,
        destination: task.destination,
        boxId: task.boxId
      });
      const response = await fetch(`http://${this.esp32Ip}/api/command?${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'NAVIGATE' })
      });
      return await response.json();
    } catch (e) {
      console.error('Erro ao enviar comando para o ESP32:', e);
      return { success: false, error: e.message };
    }
  }

  /**
   * Envia o sinal de paragem de emergência imediata ao hardware.
   */
  async triggerEmergencyStop() {
    if (this.isConnected) {
      try {
        await fetch(`http://${this.esp32Ip}/api/command?action=EMERGENCY_STOP`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'EMERGENCY_STOP' })
        });
      } catch (e) {
        console.error('Falha ao enviar paragem de emergência para o ESP32 físico:', e);
      }
    }
  }

  /**
   * Desativa a paragem de emergência no ESP32 e permite retomar a navegação ativa.
   */
  async clearEmergencyStop() {
    if (this.isConnected) {
      try {
        await fetch(`http://${this.esp32Ip}/api/command?action=EMERGENCY_CLEAR`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'EMERGENCY_CLEAR' })
        });
      } catch (e) {
        console.error('Falha ao desativar a paragem de emergência no ESP32 físico:', e);
      }
    }
  }

  /**
   * Simula a leitura física de uma tag RFID pelo leitor MFRC522 do ESP32.
   * Procura no inventário a caixa associada ao código RFID lido.
   */
  simulateRFIDScan(rfidCode) {
    const box = store.getBoxes().find(b => b.rfidTag === rfidCode || b.id === rfidCode);
    if (box) {
      store.addLog('info', `📡 Leitor RFID ESP32 leu a tag [${box.rfidTag}] correspondente à ${box.id}.`);
      return box;
    } else {
      store.addLog('error', `⚠️ Tag RFID [${rfidCode}] não reconhecida no sistema de inventário!`);
      return null;
    }
  }
}

export const apiClient = new APIClient();
