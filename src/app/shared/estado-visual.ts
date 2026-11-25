export function etiquetaEstado(estado: string): string {
  switch (estado) {
    case 'PROCESADA':
    case 'EN_PREPARACION':
      return 'Procesada';
    case 'ENTREGADA':
    case 'ENTREGADO':
      return 'Entregada';
    case 'CANCELADA':
    case 'CANCELADO':
      return 'Cancelada';
    case 'CREADA':
    case 'CREADO':
    default:
      return 'Pendiente';
  }
}

export function claseEstado(estado: string): string {
  switch (estado) {
    case 'PROCESADA':
    case 'EN_PREPARACION':
      return 'badge badge-info';
    case 'ENTREGADA':
    case 'ENTREGADO':
      return 'badge badge-success';
    case 'CANCELADA':
    case 'CANCELADO':
      return 'badge badge-danger';
    case 'CREADA':
    case 'CREADO':
    default:
      return 'badge badge-warning';
  }
}
