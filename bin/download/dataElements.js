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
const applyTransforms = require('../utils/applyTransforms');
const ora = require('ora');

module.exports = async function (args) {

  const spinner = ora('Downloading Data Elements \n');
  spinner.color = 'red';
  spinner.start();

  const reactor = args.reactor;
  const propertyId = args.propertyId;
  const propertyDirectory = `./${propertyId}`;
  const path = `${propertyDirectory}/data_elements`;

  if (!fs.existsSync(path)) {
    fs.mkdirSync(path);
  }

  // TODO: go back through and refactor this to get everything...not just 999
  const dataElements = (
    await reactor.listDataElementsForProperty(args.propertyId, {
      'page[size]': 999
    })
  ).data;

  let promises = [];
  dataElements.forEach(function (dataElement) {

    let promise = Promise.resolve();

    const dataElementPath = `${path}/${dataElement.id}`;

    if (!fs.existsSync(dataElementPath)) {
      fs.mkdirSync(dataElementPath);
    }

    // create a name that links to the original file
    const sanitizedName = '_' + sanitize(dataElement.attributes.name, {
      replacement: '_'
    });
    if (!fs.existsSync(`${path}/${sanitizedName}`)) {
      fs.symlinkSync(
        dataElement.id,
        `${path}/${sanitizedName}`,
        'dir'
      );
    }

    fs.writeFileSync(
      `${dataElementPath}/data.json`,
      JSON.stringify(dataElement, null, '  ')
    );

    // parse settings
    let settings = JSON.parse(dataElement.attributes.settings);

    // write the settings json file
    if (settings) {

      // write the settings file.
      fs.writeFileSync(
        `${dataElementPath}/settings.json`,
        JSON.stringify(settings, null, '  ')
      );

    }

    // transform settings
    if (
      settings &&
      dataElement.relationships.updated_with_extension_package &&
      dataElement.relationships.updated_with_extension_package.data
    ) {
      const extensionPackage = dataElement.relationships.updated_with_extension_package.data;

      promise = promise

      .then(function () {
        return reactor.getExtensionPackage(extensionPackage.id);
      })

      .then(function (extensionPackage) {
        var
          items,
          transforms;

        // get the data
        extensionPackage = extensionPackage.data;

        // data elements
        items = extensionPackage.attributes.data_elements;

        // find the correct rule_component that goes with this type
        items && items.every(function (item) {

          // if it is the same delegate descriptor
          if (item.id === dataElement.attributes.delegate_descriptor_id) {

            // if we have transforms
            if (item.transforms) {
              transforms = item.transforms;
            }

            // quit
            return false;
          }

          return true;
        });

        // if we have transforms, run it
        if (transforms) {
          return applyTransforms(
            transforms,
            settings,
            dataElementPath
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