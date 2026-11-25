export interface Carta {
  id: number;
  apiId?: string;
  nombre: string;
  tipo: string;
  rareza: string;
  hp?: number | null;
  imagenUrl?: string | null;
  precio: number;
}

export interface Orden {
  id?: number;
  cartaId?: number;
  cartaNombre: string;
  tipo: string;
  imagenUrl?: string | null;
  cliente: string;
  cantidad: number;
  total: number;
  estado: string;
  fecha?: string;
}

export interface SobreResultado {
  orden: Orden;
  cartas: Carta[];
}

export const TIPO_COLOR: Record<string, string> = {
  Fire: '#F08030',
  Water: '#6890F0',
  Grass: '#78C850',
  Lightning: '#F8D030',
  Psychic: '#F85888',
  Fighting: '#C03028',
  Colorless: '#A8A878',
  Darkness: '#705848',
  Metal: '#B8B8D0',
  Fairy: '#EE99AC',
  Dragon: '#7038F8',
  SOBRE: '#3B4CCA'
};

export function colorTipo(tipo: string | undefined | null): string {
  return (tipo && TIPO_COLOR[tipo]) || '#A8A878';
}

export function esHolo(rareza: string | undefined | null): boolean {
  return !!rareza && rareza.toLowerCase().includes('holo');
}
