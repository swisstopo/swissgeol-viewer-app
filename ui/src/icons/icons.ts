import {layerIcon} from './i_layer';
import {toolsIcon} from './i_tools';
import {shareIcon} from './i_share';
import {projectsIcon} from './i_menu';
import {configIcon} from './i_config';
import {viewAllIcon} from './i_view_all';
import {viewLessIcon} from './i_view_less';
import {userIcon} from './i_user';
import {checkmarkIcon} from './i_checkmark';
import {menuIcon} from "./i_menu1";
import {closeIcon} from "./i_close";

export const icons = {
  checkmark: checkmarkIcon,
  config: configIcon,
  layer: layerIcon,
  projects: projectsIcon,
  tools: toolsIcon,
  share: shareIcon,
  user: userIcon,
  viewAll: viewAllIcon,
  viewLess: viewLessIcon,
  dropdown: menuIcon,
  close: closeIcon
};

export type IconKey = keyof typeof icons;
