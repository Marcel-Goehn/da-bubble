import accountCircle from '@material-symbols/svg-400/outlined/account_circle.svg';
import arrowBack from '@material-symbols/svg-400/outlined/arrow_back.svg';
import arrowDropDown from '@material-symbols/svg-400/outlined/arrow_drop_down.svg';
import block from '@material-symbols/svg-400/outlined/block.svg';
import chatBubble from '@material-symbols/svg-400/outlined/chat_bubble.svg';
import close from '@material-symbols/svg-400/outlined/close.svg';
import keyboardArrowDown from '@material-symbols/svg-400/outlined/keyboard_arrow_down.svg';
import leftPanelClose from '@material-symbols/svg-400/outlined/left_panel_close.svg';
import leftPanelOpen from '@material-symbols/svg-400/outlined/left_panel_open.svg';
import logout from '@material-symbols/svg-400/outlined/logout.svg';
import mail from '@material-symbols/svg-400/outlined/mail.svg';
import moreVert from '@material-symbols/svg-400/outlined/more_vert.svg';
import person from '@material-symbols/svg-400/outlined/person.svg';
import personFilled from '@material-symbols/svg-400/outlined/person-fill.svg';
import sendFilled from '@material-symbols/svg-400/outlined/send-fill.svg';
import tag from '@material-symbols/svg-400/outlined/tag.svg';
import workspaces from '@material-symbols/svg-400/outlined/workspaces.svg';

/**
 * The Material Symbols the app uses, bundled as markup so nothing is fetched at runtime. Add a symbol
 * here before using its name.
 */
export const icons = {
  accountCircle,
  arrowBack,
  arrowDropDown,
  block,
  chatBubble,
  close,
  keyboardArrowDown,
  leftPanelClose,
  leftPanelOpen,
  logout,
  mail,
  moreVert,
  person,
  personFilled,
  sendFilled,
  tag,
  workspaces,
} as const;

export type IconName = keyof typeof icons;
