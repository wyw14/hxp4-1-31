import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

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

interface ScoreData {
  highScore: number;
  leaderboard: LeaderboardEntry[];
  achievements: Achievement[];
  settings: GameSettings;
  history: HistoryEntry[];
}

type DataCategory = 'highScore' | 'leaderboard' | 'achievements' | 'settings' | 'history';

const DEFAULTS: ScoreData = {
  highScore: 0,
  leaderboard: [],
  achievements: [],
  settings: { soundEnabled: true, difficulty: 'normal' },
  history: [],
};

const app = express();
const PORT = 42031;
const DATA_FILE = path.join(process.cwd(), 'server', 'data', 'scores.json');

app.use(cors());
app.use(express.json());

const readScoreData = (): ScoreData => {
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(raw) as ScoreData;
};

const writeScoreData = (data: ScoreData): void => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
};

app.get('/api/highscore', (_req, res) => {
  try {
    const data = readScoreData();
    res.json({ highScore: data.highScore });
  } catch (error) {
    res.status(500).json({ error: '读取分数失败' });
  }
});

app.post('/api/highscore', (req, res) => {
  try {
    const { score } = req.body as { score?: number };

    if (typeof score !== 'number' || score < 0) {
      return res.status(400).json({ error: '无效的分数' });
    }

    const data = readScoreData();

    if (score > data.highScore) {
      data.highScore = score;
    }

    data.history.push({
      score,
      date: new Date().toISOString(),
      duration: 0,
    });

    data.leaderboard.push({
      rank: 0,
      score,
      date: new Date().toISOString(),
    });
    data.leaderboard.sort((a, b) => b.score - a.score);
    data.leaderboard = data.leaderboard.slice(0, 10);
    data.leaderboard.forEach((entry, i) => {
      entry.rank = i + 1;
    });

    writeScoreData(data);
    res.json({ highScore: data.highScore, isNewRecord: score >= data.highScore && score > 0 });
  } catch (error) {
    res.status(500).json({ error: '保存分数失败' });
  }
});

app.get('/api/data', (_req, res) => {
  try {
    const data = readScoreData();
    res.json({
      highScore: data.highScore,
      leaderboard: data.leaderboard,
      achievements: data.achievements,
      settings: data.settings,
      history: data.history,
    });
  } catch (error) {
    res.status(500).json({ error: '读取数据失败' });
  }
});

app.delete('/api/data/:category', (req, res) => {
  try {
    const category = req.params.category as DataCategory;
    const validCategories: DataCategory[] = ['highScore', 'leaderboard', 'achievements', 'settings', 'history'];

    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: '无效的数据分类' });
    }

    const data = readScoreData();

    switch (category) {
      case 'highScore':
        data.highScore = DEFAULTS.highScore;
        break;
      case 'leaderboard':
        data.leaderboard = DEFAULTS.leaderboard;
        break;
      case 'achievements':
        data.achievements = DEFAULTS.achievements;
        break;
      case 'settings':
        data.settings = { ...DEFAULTS.settings };
        break;
      case 'history':
        data.history = DEFAULTS.history;
        break;
    }

    writeScoreData(data);
    res.json({ success: true, category, message: `${category} 数据已清空` });
  } catch (error) {
    res.status(500).json({ error: '清空数据失败' });
  }
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
