/**
 * ANDA LÁ — Factory Map & 2D AGV Visualizer (HTML5 Canvas Engine)
 * 
 * Este módulo é responsável por renderizar graficamente a planta da fábrica em tempo real.
 * Utiliza o contexto 2D do HTML5 Canvas para desenhar:
 * 1. A grelha de referência espacial da fábrica.
 * 2. Os caminhos virtuais e interligações entre as zonas de trabalho.
 * 3. Os pontos de paragem e estações de carga/descarga (Docks).
 * 4. A representação vetorial do robô AGV, com varrimento de sensor LiDAR, rotação e carga transportada.
 */

import { FACTORY_CONNECTIONS, store } from './store.js';

const MAP_WIDTH = 900;
const MAP_HEIGHT = 450;

export class FactoryMapRenderer {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.laserAngle = 0; // Ângulo para a animação do feixe do leitor LiDAR
    this.isSetup = false;
    this.resizeCanvas();

    // Redimensiona o canvas dinamicamente se a janela do navegador mudar de tamanho
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  /**
   * Garante que a resolução interna do canvas coincide exatamente com o tamanho do seu elemento pai no HTML.
   */
  resizeCanvas() {
    const parent = this.canvas.parentElement;
    if (parent) {
      this.canvas.width = parent.clientWidth || 900;
      this.canvas.height = parent.clientHeight || 450;
    }
  }

  /**
   * Ciclo principal de pintura no canvas (invocado a cada frame ~60 FPS).
   */
  render() {
    if (!this.canvas) return;
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const state = store.state;
    const agv = state.agv;

    // Limpa completamente o buffer do frame anterior
    ctx.clearRect(0, 0, width, height);
    const scale = Math.min(width / MAP_WIDTH, height / MAP_HEIGHT);
    const offsetX = (width - MAP_WIDTH * scale) / 2;
    const offsetY = (height - MAP_HEIGHT * scale) / 2;
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // 1. Desenha a grelha industrial de fundo
    this.drawGrid(ctx, MAP_WIDTH, MAP_HEIGHT);

    // 2. Desenha as linhas guia dos caminhos entre zonas
    this.drawPathways(ctx, state.zones);

    // 3. Desenha as zonas físicas (Receção, Armazém, Montagem, Expedição, Carga)
    this.drawZones(ctx, state.zones);

    // 4. Desenha zonas de alerta / obstáculos temporários
    this.drawObstacles(ctx);

    // 5. Desenha o veículo AGV com rotação, campo de visão do leitor laser e caixa de carga
    this.drawAGVRobot(ctx, agv);

    // Incrementa a fase de oscilação do feixe do sensor laser
    this.laserAngle += 0.05;
    ctx.restore();
  }

  /**
   * Desenha a grelha de coordenadas do chão da oficina.
   */
  drawGrid(ctx, width, height) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    const gridSize = 40; // Espaçamento de 40 píxeis por célula

    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  /**
   * Desenha as rotas de navegação predefinidas com estilo tracejado e luz néon.
   */
  drawPathways(ctx, zones) {
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.15)';
    ctx.lineWidth = 6;
    
    // Define padrão de linha tracejada (10px traço, 8px espaço)
    ctx.setLineDash([10, 8]);
    ctx.lineCap = 'round';

    FACTORY_CONNECTIONS.forEach(([fromCode, toCode]) => {
      const from = zones.find(zone => zone.code === fromCode);
      const to = zones.find(zone => zone.code === toCode);
      if (!from || !to) return;

      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    });
    
    // Restaura estilo de linha contínua para os elementos seguintes
    ctx.setLineDash([]);
  }

  /**
   * Desenha cada zona industrial como um alvo circular colorido com ícones e etiquetas.
   */
  drawZones(ctx, zones) {
    zones.forEach(zone => {
      // Halo exterior transparente
      ctx.fillStyle = `${zone.color}15`;
      ctx.strokeStyle = zone.color;
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.arc(zone.x, zone.y, 44, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Ponto central de paragem exata do robô
      ctx.fillStyle = zone.color;
      ctx.beginPath();
      ctx.arc(zone.x, zone.y, 8, 0, Math.PI * 2);
      ctx.fill();

      // Identificador de texto superior (ex: Zona A)
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(zone.code, zone.x, zone.y - 54);

      // Descrição inferior (ex: Receção & Triagem)
      ctx.fillStyle = 'rgba(156, 163, 175, 0.9)';
      ctx.font = '10px Inter, sans-serif';
      ctx.fillText(zone.name.split('—')[1] || '', zone.x, zone.y + 62);
    });
  }

  /**
   * Desenha zonas de aviso de manutenção e potenciais obstáculos.
   */
  drawObstacles(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
    ctx.lineWidth = 1.5;

    // Área delimitada de perigo/manutenção perto da Zona B
    ctx.fillRect(280, 200, 50, 50);
    ctx.strokeRect(280, 200, 50, 50);

    ctx.fillStyle = '#EF4444';
    ctx.font = '10px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('⚡ BARREIRA', 305, 230);
    ctx.restore();
  }

  /**
   * Renderização gráfica detalhada do robô AGV utilizando matrizes de transformação 2D.
   * Aplica translate() e rotate() para alinhar o desenho com a posição e orientação real do robô.
   */
  drawAGVRobot(ctx, agv) {
    const safeX = Number.isFinite(Number(agv.x))
      ? Math.min(Math.max(Number(agv.x), 30), MAP_WIDTH - 30)
      : 120;
    const safeY = Number.isFinite(Number(agv.y))
      ? Math.min(Math.max(Number(agv.y), 30), MAP_HEIGHT - 30)
      : 180;
    const safeAngle = Number.isFinite(Number(agv.angle)) ? Number(agv.angle) : 0;

    ctx.save();
    
    // Translada a origem do contexto para o centro do AGV e roda de acordo com o seu ângulo de orientação
    ctx.translate(safeX, safeY);
    ctx.rotate(safeAngle);

    // --- 1. Campo de Visão (FOV Cone) do Sensor LiDAR / Deteção de Obstáculos ---
    const scanRadius = 60; // Alcance do feixe laser de 60 píxeis
    const sweepAngle = Math.PI / 3; // Leque de visão de 60 graus
    const currentSweep = Math.sin(this.laserAngle) * (sweepAngle / 2); // Oscilação do feixe

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, scanRadius, currentSweep - sweepAngle / 2, currentSweep + sweepAngle / 2);
    ctx.closePath();
    ctx.fillStyle = agv.status === 'error' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(0, 242, 254, 0.12)';
    ctx.fill();

    // --- 2. Sombra com Efeito Glow Néon ---
    ctx.shadowColor = agv.status === 'error' ? '#EF4444' : '#00F2FE';
    ctx.shadowBlur = agv.status === 'moving' ? 15 : 8;

    // Chassis Principal do AGV (Retângulo com cantos arredondados)
    ctx.fillStyle = agv.status === 'error' ? '#1F1010' : '#111827';
    ctx.strokeStyle = agv.status === 'error' ? '#EF4444' : agv.status === 'moving' ? '#06B6D4' : '#00F2FE';
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    ctx.roundRect(-23, -17, 46, 34, 6);
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0; // Desativa a sombra para os componentes seguintes

    // --- 3. Rodas Motrizes Laterais (Sistema Diferencial) ---
    ctx.fillStyle = '#374151';
    ctx.fillRect(-12, -21, 24, 4); // Roda Esquerda
    ctx.fillRect(-12, 17, 24, 4);  // Roda Direita

    // --- 4. Seta Indicadora da Direção de Frente ---
    ctx.fillStyle = agv.status === 'moving' ? '#00F2FE' : '#10B981';
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(2, -8);
    ctx.lineTo(2, 8);
    ctx.closePath();
    ctx.fill();

    // --- 5. Caixa de Carga Transportada (Se o AGV tiver uma caixa a bordo) ---
    if (agv.carriedBoxId) {
      ctx.fillStyle = '#F59E0B'; // Cor de caixa industrial amarelada
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.fillRect(-10, -10, 20, 20);
      ctx.strokeRect(-10, -10, 20, 20);

      // Texto do ID da caixa em cima da própria caixa
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 8px JetBrains Mono';
      ctx.textAlign = 'center';
      ctx.fillText(agv.carriedBoxId.replace('BOX-', ''), 0, 3);
    }

    // Restaura o estado da matriz de transformação (cancela a rotação e translação)
    ctx.restore();

    // --- 6. Etiqueta Flutuante de Estado em Cima do Robô ---
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`ANDA LÁ [${Math.round(agv.battery)}%]`, safeX, safeY - 30);
    ctx.restore();
  }
}
