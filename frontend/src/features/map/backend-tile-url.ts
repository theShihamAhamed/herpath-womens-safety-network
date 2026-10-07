import { environment } from '@/src/config/environment';

export function getBackendTileUrlTemplate(): string {
  return `${environment.apiBaseUrl}/map/tiles/{z}/{x}/{y}`;
}
