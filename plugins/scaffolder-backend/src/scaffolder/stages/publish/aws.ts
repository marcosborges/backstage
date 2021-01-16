/*
 * Copyright 2020 Spotify AB
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { PublisherBase, PublisherOptions, PublisherResult } from './types';
import { CodeCommit } from 'aws-sdk';
import { JsonValue } from '@backstage/config';
import { RequiredTemplateValues } from '../templater';
import { initRepoAndPush } from './helpers';

export class AwsPublisher implements PublisherBase {
  
  async publish({
    values,
    directory,
    logger,
  }: PublisherOptions): Promise<PublisherResult> {
    
    const remoteUrl = await this.createRemote(values);
    const catalogInfoUrl = `${remoteUrl}?path=%2Fcatalog-info.yaml`;

    await initRepoAndPush({
      dir: directory,
      remoteUrl,
      auth: {
        username: 'notempty',
        password: this.token,
      },
      logger,
    });

    return { remoteUrl, catalogInfoUrl };
  }

  private async createRemote(
    values: RequiredTemplateValues & Record<string, JsonValue>,
  ) {
    
    const name = values.storePath;

    var params = {
      repositoryName: name, /* required */
      repositoryDescription: values.description,
      tags: {
        'creator': 'Backstage'
      }
    };
    const codecommit: CodeCommit = new CodeCommit({apiVersion: '2015-04-13'});
    try {
      const repo:any = await codecommit.createRepository(params);
      console.log(repo)   
      /*{
          "repositoryMetadata": {
              "repositoryName": "MyDemoRepo",
              "cloneUrlSsh": "ssh://git-codecommit.us-east-1.amazonaws.com/v1/repos/MyDemoRepo",
              "lastModifiedDate": 1446071622.494,
              "repositoryDescription": "My demonstration repository",
              "cloneUrlHttp": "https://git-codecommit.us-east-1.amazonaws.com/v1/repos/MyDemoRepo",
              "creationDate": 1446071622.494,
              "repositoryId": "f7579e13-b83e-4027-aaef-650c0EXAMPLE",
              "Arn": "arn:aws:codecommit:us-east-1:123456789012EXAMPLE:MyDemoRepo",
              "accountId": "123456789012"
          }
      }*/
      return repo.repositoryMetadata.cloneUrlHttp;
    } catch (err) {
      console.error(err)
      return ""
    }
    
  }
}
