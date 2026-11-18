// O projeto não tem @types/react-dom: só a parte que o player do editor usa
declare module "react-dom/client" {
  export type Root = { render(no: import("react").ReactNode): void; unmount(): void };
  export function createRoot(el: Element): Root;
}
