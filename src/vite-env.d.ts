/// <reference types="vite/client" />

declare module "*.st?raw" {
  const content: string;
  export default content;
}

declare module "*.txt?raw" {
  const content: string;
  export default content;
}
