import './style.css';
import { ensureFonts } from './render';
import { initExportPanel } from './ui/exportPanel';
import { initHeadsPanel } from './ui/headsPanel';
import { initPeoplePanel } from './ui/peoplePanel';
import { initRosterPanel } from './ui/rosterPanel';
import { initStage } from './ui/stage';
import { initStylePanel } from './ui/stylePanel';
import { initTemplatePanel } from './ui/templatePanel';
import { initTheme } from './ui/theme';

async function main(): Promise<void> {
  initTheme();
  initStylePanel();
  initStage();
  initHeadsPanel();
  initPeoplePanel();
  initExportPanel();

  // 先把常用字元的字型要回來，第一次畫就不會用到備用字型
  const fonts = ensureFonts('?0123456789@');
  await Promise.all([initRosterPanel(), fonts]);
  await initTemplatePanel();
}

void main();
