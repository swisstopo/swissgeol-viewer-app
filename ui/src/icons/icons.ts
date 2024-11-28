import {layerIcon} from './i_layer';
import {toolsIcon} from './i_tools';
import {shareIcon} from './i_share';
import {projectsIcon} from './i_menu';
import {configIcon} from './i_config';
import {viewAllIcon} from './i_view_all';
import {viewLessIcon} from './i_view_less';

export const icons = {
  config: configIcon,
  layer: layerIcon,
  projects: projectsIcon,
  tools: toolsIcon,
  share: shareIcon,
  view_all: viewAllIcon,
  view_less: viewLessIcon
};

export type IconKey = keyof typeof icons;
