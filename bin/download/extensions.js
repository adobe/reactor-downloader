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
// Ajv = require('ajv'),
// ajv = new Ajv({schemaId: 'id'}),
const applyTransforms = require('../utils/applyTransforms');
const ora = require('ora');

// make sure version 4 is supported
// ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-04.json'));

module.exports = async function (args) {

  const spinner = ora('Downloading Extensions \n');
  spinner.color = 'magenta';
  spinner.start();

  const reactor = args.reactor;
  const propertyId = args.propertyId;
  const propertyDirectory = `./${propertyId}`;
  const path = `${propertyDirectory}/extensions`;

  if (!fs.existsSync(path)) {
    fs.mkdirSync(path);
  }

  // TODO: go back through and refactor this to get everything...not just 999
  const extensions = (
    await reactor.listExtensionsForProperty(args.propertyId, {
      'page[size]': 999
    })
  ).data;

  let promises = [];
  extensions.forEach(function (extension) {

    let promise = Promise.resolve();

    const extensionPath = `${path}/${extension.id}`;

    if (!fs.existsSync(extensionPath)) {
      fs.mkdirSync(extensionPath);
    }

    // create a name that links to the original file
    const sanitizedName = '_' + sanitize(extension.attributes.name, {
      replacement: '_'
    });
    if (!fs.existsSync(`${path}/${sanitizedName}`)) {
      fs.symlinkSync(
        extension.id,
        `${path}/${sanitizedName}`,
        'dir'
      );
    }

    fs.writeFileSync(
      `${extensionPath}/data.json`,
      JSON.stringify(extension, null, '  ')
    );

    // parse settings
    let settings = JSON.parse(extension.attributes.settings);

    // write the settings json file
    if (settings) {

      // write the settings file.
      fs.writeFileSync(
        `${extensionPath}/settings.json`,
        JSON.stringify(settings, null, '  ')
      );

    }

    // transform settings
    if (
      settings &&
      extension.relationships.extension_package &&
      extension.relationships.extension_package.data
    ) {

      const extensionPackage = extension.relationships.extension_package.data;

      promise = promise

      .then(function () {
        return reactor.getExtensionPackage(extensionPackage.id);
      })

      .then(function (extensionPackage) {

        // get the data
        extensionPackage = extensionPackage.data;

        // transforms
        if (
          extensionPackage.attributes.configuration &&
          extensionPackage.attributes.configuration.transforms
        ) {

          // apply them
          return applyTransforms(
            extensionPackage.attributes.configuration.transforms,
            settings,
            extensionPath
          );

        }
          
      });

    }

    promises.push(promise);
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