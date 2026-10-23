/** SVGs import as their markup (the `.svg` text loader in angular.json). */
declare module '*.svg' {
  const markup: string;
  export default markup;
}
