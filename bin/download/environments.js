/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

const fs = require('fs');
const sanitize = require('sanitize-filename');
const ora = require('ora');

module.exports = async function (args) {

  const spinner = ora('Downloading Environments \n');
  spinner.color = 'yellow';
  spinner.start();

  const reactor = args.reactor;
  const propertyId = args.propertyId;
  const propertyDirectory = `./${propertyId}`;
  const path = `${propertyDirectory}/environments`;

  if (!fs.existsSync(path)) {
    fs.mkdirSync(path);
  }

  // TODO: go back through and refactor this to get everything...not just 999
  const environments = (
    await reactor.listEnvironmentsForProperty(args.propertyId, {
      'page[size]': 999
    })
  ).data;
  
  environments.forEach(function (environment) {

    const environmentPath = `${path}/${environment.id}`;

    if (!fs.existsSync(environmentPath)) {
      fs.mkdirSync(environmentPath);
    }

    // create a name that links to the original file
    const sanitizedName = '_' + sanitize(environment.attributes.name, {
      replacement: '_'
    });
    if (!fs.existsSync(`${path}/${sanitizedName}`)) {
      fs.symlinkSync(
        environment.id,
        `${path}/${sanitizedName}`,
        'dir'
      );
    }

    fs.writeFileSync(
      `${environmentPath}/data.json`,
      JSON.stringify(environment, null, '  ')
    );

  });

  spinner.stop();

};