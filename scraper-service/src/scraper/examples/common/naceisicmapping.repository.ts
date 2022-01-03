import { NaceIsicMapping } from './naceisicmapping.model';

export class NaceIsicMappingRepository {
  async findByNace(nace: string): Promise<NaceIsicMapping> {
    return new NaceIsicMapping();
  }
}
