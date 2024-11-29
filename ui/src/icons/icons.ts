import {layerIcon} from './i_layer';
import {toolsIcon} from './i_tools';
import {shareIcon} from './i_share';
import {projectsIcon} from './i_menu';
import {configIcon} from './i_config';

export const icons = {
  config: configIcon,
  layer: layerIcon,
  projects: projectsIcon,
  tools: toolsIcon,
  share: shareIcon,
};

export type IconKey = keyof typeof icons;
