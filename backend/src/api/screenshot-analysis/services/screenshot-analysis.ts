import screenshotAnalysisController from '../controllers/screenshot-analysis';
import { cleanupEmployeeScreenshots } from './screenshot-retention';

export default {
  ...screenshotAnalysisController,
  cleanupEmployeeScreenshots,
};
