import { DKSicMapping } from './dksicmapping.model';
import * as mapping from './dksicmapping.json';

/*
 In-memory repository localised dk sic to nace mapping.

 It is assumed that this might be replaced with database backed
 repositories at some point in the future, so the interface is 
 asynchronous in order for it not to break when a new implementation
 is introduced.
 */
export class DKSicMappingRepository {
  async findByDkSic(sic: string): Promise<DKSicMapping[]> {
    return mapping.filter((record) => record.dksic === sic);
  }
}
