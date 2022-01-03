import { DKSicMapping } from './dksicmapping.model';

export class DKSicMappingRepository {
  async findByDkSic(sic: string): Promise<DKSicMapping[]> {
    return [];
  }
}
