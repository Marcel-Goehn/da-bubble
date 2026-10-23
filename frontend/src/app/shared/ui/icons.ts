import close from '@material-symbols/svg-400/outlined/close.svg';
import logout from '@material-symbols/svg-400/outlined/logout.svg';
import person from '@material-symbols/svg-400/outlined/person.svg';
import personFilled from '@material-symbols/svg-400/outlined/person-fill.svg';

/**
 * The Material Symbols the app uses, bundled as markup so nothing is fetched at runtime. Add a symbol
 * here before using its name.
 */
export const icons = { close, logout, person, personFilled } as const;

export type IconName = keyof typeof icons;
