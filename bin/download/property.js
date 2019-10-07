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
const downloadDataElements = require('./dataElements');
const downloadEnvironments = require('./environments');
const downloadExtensions = require('./extensions');
const downloadRules = require('./rules');
const downloadRuleComponents = require('./ruleComponents');

module.exports = async (args) => {

  const propertyId = args.propertyId;
  const reactor = args.reactor;

  // check to make sure we have all of the correct information
  if (!propertyId) {
    throw Error('no "propertyId" property.');
  }

  const propertyDirectory = `./${propertyId}`;

  // make sure the directory exists
  if (!fs.existsSync(propertyDirectory)) {
    fs.mkdirSync(propertyDirectory);
  }

  // get the property from launch
  const property = (await reactor.getProperty(propertyId)).data;

  // create a name that links to the original file
  const sanitizedName = '_' + sanitize(property.attributes.name, {
    replacement: '_'
  });
  if (!fs.existsSync(`./${sanitizedName}`)) {
    fs.symlinkSync(
      property.id,
      `./${sanitizedName}`,
      'dir'
    );
  }

  // write the data.json file to represent the property
  fs.writeFileSync(
    `${propertyDirectory}/data.json`, 
    JSON.stringify(property, null, '  ')
  );

  await Promise.all([
    // download data elements
    downloadDataElements(args),
    // download environments
    downloadEnvironments(args),
    // download extensions 
    downloadExtensions(args),
    // download rules 
    downloadRules(args),
    // download rule_components
    downloadRuleComponents(args),
  ]);

};