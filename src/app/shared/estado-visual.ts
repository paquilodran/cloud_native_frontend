export function etiquetaEstado(estado: string): string {
  switch (estado) {
    case 'EN_PREPARACION':
      return 'En proceso';
    case 'ENTREGADO':
      return 'Entregado';
    case 'CANCELADO':
      return 'Cancelado';
    case 'CREADO':
    default:
      return 'Pendiente';
  }
}

export function claseEstado(estado: string): string {
  switch (estado) {
    case 'EN_PREPARACION':
      return 'badge badge-info';
    case 'ENTREGADO':
      return 'badge badge-success';
    case 'CANCELADO':
      return 'badge badge-danger';
    case 'CREADO':
    default:
      return 'badge badge-warning';
  }
}
