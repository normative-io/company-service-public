// Copyright 2022 Meta Mind AB
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
import { NaceIsicMapping } from './naceisicmapping.model';
import * as mapping from './isicmapping.json';

/*
 In-memory repository nace to isic mapping.

 It is assumed that this might be replaced with database backed
 repositories at some point in the future, so the interface is 
 asynchronous in order for it not to break when a new implementation
 is introduced.
 */
export class NaceIsicMappingRepository {
  async findByNace(nace: string): Promise<NaceIsicMapping | undefined> {
    return mapping.filter((record) => record.nace === nace).shift();
  }
}
