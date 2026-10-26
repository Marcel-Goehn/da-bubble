import attachFile from '@material-symbols/svg-400/outlined/attach_file.svg';
import audioFile from '@material-symbols/svg-400/outlined/audio_file.svg';
import description from '@material-symbols/svg-400/outlined/description.svg';
import download from '@material-symbols/svg-400/outlined/download.svg';
import image from '@material-symbols/svg-400/outlined/image.svg';
import movie from '@material-symbols/svg-400/outlined/movie.svg';
import pictureAsPdf from '@material-symbols/svg-400/outlined/picture_as_pdf.svg';
import accountCircle from '@material-symbols/svg-400/outlined/account_circle.svg';
import add from '@material-symbols/svg-400/outlined/add.svg';
import addCircle from '@material-symbols/svg-400/outlined/add_circle.svg';
import addReaction from '@material-symbols/svg-400/outlined/add_reaction.svg';
import arrowBack from '@material-symbols/svg-400/outlined/arrow_back.svg';
import arrowDropDown from '@material-symbols/svg-400/outlined/arrow_drop_down.svg';
import block from '@material-symbols/svg-400/outlined/block.svg';
import chevronLeft from '@material-symbols/svg-400/outlined/chevron_left.svg';
import chevronRight from '@material-symbols/svg-400/outlined/chevron_right.svg';
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
import upload from '@material-symbols/svg-400/outlined/upload.svg';
import face from '@material-symbols/svg-400/outlined/face.svg';
import deleteIcon from '@material-symbols/svg-400/outlined/delete.svg';
import error from '@material-symbols/svg-400/outlined/error.svg';

/**
 * The Material Symbols the app uses, bundled as markup so nothing is fetched at runtime. Add a symbol
 * here before using its name.
 */
export const icons = {
  upload,
  face,
  delete: deleteIcon,
  error,
  attachFile,
  audioFile,
  description,
  download,
  image,
  movie,
  pictureAsPdf,
  accountCircle,
  add,
  addCircle,
  addReaction,
  arrowBack,
  arrowDropDown,
  block,
  chatBubble,
  chevronLeft,
  chevronRight,
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
