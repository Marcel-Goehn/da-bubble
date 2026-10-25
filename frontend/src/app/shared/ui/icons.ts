import accountCircle from '@material-symbols/svg-400/outlined/account_circle.svg';
import add from '@material-symbols/svg-400/outlined/add.svg';
import addCircle from '@material-symbols/svg-400/outlined/add_circle.svg';
import addReaction from '@material-symbols/svg-400/outlined/add_reaction.svg';
import arrowBack from '@material-symbols/svg-400/outlined/arrow_back.svg';
import arrowDropDown from '@material-symbols/svg-400/outlined/arrow_drop_down.svg';
import block from '@material-symbols/svg-400/outlined/block.svg';
import chatBubble from '@material-symbols/svg-400/outlined/chat_bubble.svg';
import close from '@material-symbols/svg-400/outlined/close.svg';
import comment from '@material-symbols/svg-400/outlined/comment.svg';
import edit from '@material-symbols/svg-400/outlined/edit.svg';
import editSquare from '@material-symbols/svg-400/outlined/edit_square.svg';
import info from '@material-symbols/svg-400/outlined/info.svg';
import personAdd from '@material-symbols/svg-400/outlined/person_add.svg';
import personRemove from '@material-symbols/svg-400/outlined/person_remove.svg';
import keyboardArrowDown from '@material-symbols/svg-400/outlined/keyboard_arrow_down.svg';
import leftPanelClose from '@material-symbols/svg-400/outlined/left_panel_close.svg';
import leftPanelOpen from '@material-symbols/svg-400/outlined/left_panel_open.svg';
import logout from '@material-symbols/svg-400/outlined/logout.svg';
import mail from '@material-symbols/svg-400/outlined/mail.svg';
import mood from '@material-symbols/svg-400/outlined/mood.svg';
import moreVert from '@material-symbols/svg-400/outlined/more_vert.svg';
import person from '@material-symbols/svg-400/outlined/person.svg';
import personFilled from '@material-symbols/svg-400/outlined/person-fill.svg';
import sendFilled from '@material-symbols/svg-400/outlined/send-fill.svg';
import starFilled from '@material-symbols/svg-400/outlined/star-fill.svg';
import tag from '@material-symbols/svg-400/outlined/tag.svg';
import workspaces from '@material-symbols/svg-400/outlined/workspaces.svg';

/**
 * The Material Symbols the app uses, bundled as markup so nothing is fetched at runtime. Add a symbol
 * here before using its name.
 */
export const icons = {
  accountCircle,
  add,
  addCircle,
  addReaction,
  arrowBack,
  arrowDropDown,
  block,
  chatBubble,
  close,
  comment,
  edit,
  editSquare,
  info,
  personAdd,
  personRemove,
  keyboardArrowDown,
  leftPanelClose,
  leftPanelOpen,
  logout,
  mail,
  mood,
  moreVert,
  person,
  personFilled,
  sendFilled,
  starFilled,
  tag,
  workspaces,
} as const;

export type IconName = keyof typeof icons;
