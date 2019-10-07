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

  const spinner = ora('Downloading Rules \n');
  spinner.color = 'blue';
  spinner.start();

  const reactor = args.reactor;
  const propertyId = args.propertyId;
  const propertyDirectory = `./${propertyId}`;
  const path = `${propertyDirectory}/rules`;

  if (!fs.existsSync(path)) {
    fs.mkdirSync(path);
  }

  // TODO: go back through and refactor this to get everything...not just 999
  const rules = (
    await reactor.listRulesForProperty(args.propertyId, {
      'page[size]': 999
    })
  ).data;

  let promises = [];
  rules.forEach(function (rule) {

    const rulePath = `${path}/${rule.id}`;

    if (!fs.existsSync(rulePath)) {
      fs.mkdirSync(rulePath);
    }

    // create a name that links to the original file
    const sanitizedName = '_' + sanitize(rule.attributes.name, {
      replacement: '_'
    });
    if (!fs.existsSync(`${path}/${sanitizedName}`)) {
      fs.symlinkSync(
        rule.id,
        `${path}/${sanitizedName}`,
        'dir'
      );
    }

    fs.writeFileSync(
      `${rulePath}/data.json`,
      JSON.stringify(rule, null, '  ')
    );

    // promises.push(doRuleComponents(rule, api));
  });

  return Promise.all(promises)
  .then(() => {
    spinner.stop();
  })
  .catch((e) => {
    console.error(e);
    spinner.stop();
  });

};