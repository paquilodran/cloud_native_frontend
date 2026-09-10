export interface Pedido {
  id?: number;
  nombre: string;
  cliente: string;
  estado: string;
  total: number;
  fecha?: string;
}
