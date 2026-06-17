type Color = 'red' | 'yellow' | 'blue' | 'green';

const COLORS: Color[] = ['red', 'yellow', 'blue', 'green'];

interface HighScoreResponse {
  highScore: number;
  isNewRecord?: boolean;
}

type DataCategory = 'highScore' | 'leaderboard' | 'achievements' | 'settings' | 'history';

interface LeaderboardEntry {
  rank: number;
  score: number;
  date: string;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  unlockedAt: string;
}

interface GameSettings {
  soundEnabled: boolean;
  difficulty: string;
}

interface HistoryEntry {
  score: number;
  date: string;
  duration: number;
}

interface AllData {
  highScore: number;
  leaderboard: LeaderboardEntry[];
  achievements: Achievement[];
  settings: GameSettings;
  history: HistoryEntry[];
}

const CATEGORY_LABELS: Record<DataCategory, string> = {
  highScore: '最高分',
  leaderboard: '排行榜',
  achievements: '成就',
  settings: '设置',
  history: '历史战绩',
};

class ColorMemoryGame {
  private sequence: Color[] = [];
  private playerIndex: number = 0;
  private isPlaying: boolean = false;
  private isShowingSequence: boolean = false;
  private level: number = 0;
  private highScore: number = 0;

  private readonly buttons: NodeListOf<HTMLButtonElement>;
  private readonly startBtn: HTMLButtonElement;
  private readonly currentLevelEl: HTMLElement;
  private readonly highScoreEl: HTMLElement;
  private readonly gameStatusEl: HTMLElement;

  private readonly lightOnDuration: number = 600;
  private readonly lightOffDuration: number = 300;

  private pendingClearCategory: DataCategory | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.buttons = document.querySelectorAll('.color-btn');
    this.startBtn = document.getElementById('start-btn') as HTMLButtonElement;
    this.currentLevelEl = document.getElementById('current-level') as HTMLElement;
    this.highScoreEl = document.getElementById('high-score') as HTMLElement;
    this.gameStatusEl = document.getElementById('game-status') as HTMLElement;

    this.init();
  }

  private async init(): Promise<void> {
    this.setupEventListeners();
    this.setupDataCenter();
    await this.fetchHighScore();
  }

  private setupEventListeners(): void {
    this.startBtn.addEventListener('click', () => this.startGame());

    this.buttons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const color = (e.target as HTMLButtonElement).dataset.color as Color;
        this.handlePlayerInput(color);
      });
    });
  }

  private setupDataCenter(): void {
    const toggleBtn = document.getElementById('toggle-data-center') as HTMLButtonElement;
    const dataCenter = document.getElementById('data-center') as HTMLElement;
    const confirmModal = document.getElementById('confirm-modal') as HTMLElement;
    const confirmCancel = document.getElementById('confirm-cancel') as HTMLButtonElement;
    const confirmOk = document.getElementById('confirm-ok') as HTMLButtonElement;
    const confirmMessage = document.getElementById('confirm-message') as HTMLElement;

    toggleBtn.addEventListener('click', () => {
      const isHidden = dataCenter.classList.contains('hidden');
      if (isHidden) {
        dataCenter.classList.remove('hidden');
        this.loadAllData();
      } else {
        dataCenter.classList.add('hidden');
      }
    });

    document.querySelectorAll('.clear-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const category = (e.target as HTMLButtonElement).dataset.category as DataCategory;
        this.pendingClearCategory = category;
        confirmMessage.textContent = `确定要清空「${CATEGORY_LABELS[category]}」数据吗？此操作不可恢复。`;
        confirmModal.classList.remove('hidden');
      });
    });

    confirmCancel.addEventListener('click', () => {
      confirmModal.classList.add('hidden');
      this.pendingClearCategory = null;
    });

    confirmOk.addEventListener('click', () => {
      if (this.pendingClearCategory) {
        this.clearCategory(this.pendingClearCategory);
      }
      confirmModal.classList.add('hidden');
      this.pendingClearCategory = null;
    });

    confirmModal.addEventListener('click', (e) => {
      if (e.target === confirmModal) {
        confirmModal.classList.add('hidden');
        this.pendingClearCategory = null;
      }
    });
  }

  private async loadAllData(): Promise<void> {
    try {
      const response = await fetch('/api/data');
      const data = await response.json() as AllData;

      this.setDataInfo('info-highScore', data.highScore === 0 ? '暂无记录' : `最高 ${data.highScore} 关`);
      this.setDataInfo('info-leaderboard', data.leaderboard.length === 0 ? '暂无数据' : `${data.leaderboard.length} 条记录，最高 ${data.leaderboard[0]?.score ?? 0} 关`);
      this.setDataInfo('info-achievements', data.achievements.length === 0 ? '暂无成就' : `已解锁 ${data.achievements.length} 个成就`);
      this.setDataInfo('info-settings', `音效: ${data.settings.soundEnabled ? '开' : '关'} | 难度: ${data.settings.difficulty}`);
      this.setDataInfo('info-history', data.history.length === 0 ? '暂无记录' : `${data.history.length} 条战绩记录`);
    } catch (error) {
      console.error('加载数据失败:', error);
    }
  }

  private setDataInfo(elementId: string, text: string): void {
    const el = document.getElementById(elementId);
    if (el) el.textContent = text;
  }

  private async clearCategory(category: DataCategory): Promise<void> {
    try {
      const response = await fetch(`/api/data/${category}`, { method: 'DELETE' });
      const result = await response.json() as { success?: boolean; message?: string };

      if (result.success) {
        this.showToast(`${CATEGORY_LABELS[category]} 数据已清空`);

        if (category === 'highScore') {
          this.highScore = 0;
          this.highScoreEl.textContent = '0';
        }

        this.loadAllData();
      }
    } catch (error) {
      console.error('清空数据失败:', error);
      this.showToast('操作失败，请重试');
    }
  }

  private showToast(message: string): void {
    const toast = document.getElementById('toast') as HTMLElement;
    toast.textContent = message;
    toast.classList.remove('hidden');

    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      toast.classList.add('hidden');
    }, 2500);
  }

  private async fetchHighScore(): Promise<void> {
    try {
      const response = await fetch('/api/highscore');
      const data = await response.json() as HighScoreResponse;
      this.highScore = data.highScore;
      this.highScoreEl.textContent = this.highScore.toString();
    } catch (error) {
      console.error('获取最高分失败:', error);
    }
  }

  private async saveHighScore(score: number): Promise<void> {
    try {
      const response = await fetch('/api/highscore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ score }),
      });
      const data = await response.json() as HighScoreResponse;
      this.highScore = data.highScore;
      this.highScoreEl.textContent = this.highScore.toString();

      if (data.isNewRecord) {
        this.showStatus('🎉 新纪录！', 'success');
      }
    } catch (error) {
      console.error('保存最高分失败:', error);
    }
  }

  private startGame(): void {
    this.sequence = [];
    this.playerIndex = 0;
    this.level = 0;
    this.isPlaying = true;
    this.currentLevelEl.textContent = '0';

    this.setButtonsDisabled(true);
    this.startBtn.disabled = true;

    this.showStatus('游戏开始！', 'playing');
    this.nextRound();
  }

  private nextRound(): void {
    this.level++;
    this.currentLevelEl.textContent = this.level.toString();
    this.playerIndex = 0;

    const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    this.sequence.push(randomColor);

    this.showStatus(`第 ${this.level} 关 - 记住序列`, 'playing');
    this.showSequence();
  }

  private async showSequence(): Promise<void> {
    this.isShowingSequence = true;
    this.setButtonsDisabled(true);

    await this.delay(500);

    for (let i = 0; i < this.sequence.length; i++) {
      const color = this.sequence[i];
      await this.lightUpButton(color);

      if (i < this.sequence.length - 1) {
        await this.delay(this.lightOffDuration);
      }
    }

    this.isShowingSequence = false;
    this.setButtonsDisabled(false);
    this.showStatus('请按顺序点击按钮', 'playing');
  }

  private async lightUpButton(color: Color): Promise<void> {
    const button = this.getButtonByColor(color);
    if (!button) return;

    button.classList.add('active');
    await this.delay(this.lightOnDuration);
    button.classList.remove('active');
  }

  private getButtonByColor(color: Color): HTMLButtonElement | null {
    return document.querySelector(`.color-btn[data-color="${color}"]`);
  }

  private async handlePlayerInput(color: Color): Promise<void> {
    if (!this.isPlaying || this.isShowingSequence) return;

    const expectedColor = this.sequence[this.playerIndex];
    const button = this.getButtonByColor(color);

    if (color === expectedColor) {
      button?.classList.add('correct');
      await this.delay(200);
      button?.classList.remove('correct');

      this.playerIndex++;

      if (this.playerIndex === this.sequence.length) {
        this.showStatus('正确！准备下一关...', 'success');
        this.setButtonsDisabled(true);
        await this.delay(1000);
        this.nextRound();
      }
    } else {
      button?.classList.add('wrong');
      await this.delay(500);
      button?.classList.remove('wrong');

      this.gameOver();
    }
  }

  private async gameOver(): Promise<void> {
    this.isPlaying = false;
    this.setButtonsDisabled(true);
    this.startBtn.disabled = false;

    const finalScore = this.level - 1;
    this.showStatus(`游戏结束！你完成了 ${finalScore} 关`, 'gameover');

    if (finalScore > this.highScore) {
      await this.saveHighScore(finalScore);
    }
  }

  private setButtonsDisabled(disabled: boolean): void {
    this.buttons.forEach(btn => {
      btn.disabled = disabled;
    });
  }

  private showStatus(message: string, type: 'playing' | 'gameover' | 'success' | '' = ''): void {
    this.gameStatusEl.textContent = message;
    this.gameStatusEl.className = 'game-status';
    if (type) {
      this.gameStatusEl.classList.add(type);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

new ColorMemoryGame();
