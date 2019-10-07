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

  const spinner = ora('Downloading Rule Components \n');
  spinner.color = 'green';
  spinner.start();

  const reactor = args.reactor;
  const propertyId = args.propertyId;
  const propertyDirectory = `./${propertyId}`;
  const path = `${propertyDirectory}/rule_components`;

  if (!fs.existsSync(path)) {
    fs.mkdirSync(path);
  }

  // TODO: go back through and refactor this to get everything...not just 999
  const rules = (
    await reactor.listRulesForProperty(args.propertyId, {
      'page[size]': 999
    })
  ).data;

  // const ruleComponents = await property.getRuleComponents();
  let ruleComponents = [];
  let ruleComponentsPromises = [];
  for (let rule of rules) {

    ruleComponentsPromises.push(
      reactor.listRuleComponentsForRule(rule.id, {
        'page[size]': 999
      })
      .then((response) => {
        ruleComponents = ruleComponents.concat(response.data);
      })
    );

    // const tempRuleComponents = (
    //   await reactor.listRuleComponentsForRule(rule.id, {
    //     'page[size]': 999
    //   })
    // ).data;
    // ruleComponents = ruleComponents.concat(tempRuleComponents);
  }

  // wait for all of them to finish
  await Promise.all(ruleComponentsPromises);

  let promises = [];
  for (let ruleComponent of ruleComponents) {

    let promise = Promise.resolve();

    const ruleComponentPath = `${path}/${ruleComponent.id}`;

    if (!fs.existsSync(ruleComponentPath)) {
      fs.mkdirSync(ruleComponentPath);
    }

    // TODO: figure out what to do here.  We could have a LOT of similar names
    // for rule components, making this useless...
    // create a name that links to the original file
    // const sanitizedName = '_' + sanitize(ruleComponent.attributes.name, {
    //   replacement: '_'
    // });
    // fs.symlinkSync(
    //   ruleComponent.id,
    //   `${path}/${sanitizedName}`,
    //   'dir'
    // );

    // get all of the rules this ruleComponent is associated with
    // and make a symlink into the rule comonents directory
    // const rules = await ruleComponent.getRules();
    const rules = (
      await reactor.listRulesForRuleComponent(ruleComponent.id, {
        'page[size]': 999
      })
    ).data;
    for (const rule of rules) {
      let ruleRuleComponentsPath = `${propertyDirectory}/rules/${rule.id}/rule_components`;
      if (!fs.existsSync(ruleRuleComponentsPath)) {
        fs.mkdirSync(ruleRuleComponentsPath);
      }

      if (!fs.existsSync(`${ruleRuleComponentsPath}/${ruleComponent.id}`)) {
        fs.symlinkSync(
          `../../../rule_components/${ruleComponent.id}`,
          `${ruleRuleComponentsPath}/${ruleComponent.id}`,
          'dir'
        );
      }

      // create a name that links to the original file
      const sanitizedName = '_' + sanitize(ruleComponent.attributes.name, {
        replacement: '_'
      });
      if (!fs.existsSync(`${ruleRuleComponentsPath}/${sanitizedName}`)) {
        fs.symlinkSync(
          `../../../rule_components/${ruleComponent.id}`,
          `${ruleRuleComponentsPath}/${sanitizedName}`,
          'dir'
        );
      }
      
    }

    fs.writeFileSync(
      `${ruleComponentPath}/data.json`,
      JSON.stringify(ruleComponent, null, '  ')
    );

    // parse settings
    let settings = JSON.parse(ruleComponent.attributes.settings);

    // write the settings json file
    if (settings) {

      // write the settings file.
      fs.writeFileSync(
        `${ruleComponentPath}/settings.json`,
        JSON.stringify(settings, null, '  ')
      );

    }

    // transform settings
    if (
      settings &&
      ruleComponent.relationships.updated_with_extension_package &&
      ruleComponent.relationships.updated_with_extension_package.data
    ) {

      const extensionPackage = ruleComponent.relationships.updated_with_extension_package.data;

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

        // if actions
        if (
          ruleComponent.attributes.delegate_descriptor_id.indexOf('::actions::') !== -1 &&
          extensionPackage.attributes.actions
        ) {
          items = extensionPackage.attributes.actions;

        // if events
        } else if (
          ruleComponent.attributes.delegate_descriptor_id.indexOf('::events::') !== -1 &&
          extensionPackage.attributes.events
        ) {
          items = extensionPackage.attributes.events;

        // if conditions
        } else if (
          ruleComponent.attributes.delegate_descriptor_id.indexOf('::conditions::') !== -1 &&
          extensionPackage.attributes.conditions
        ) {
          items = extensionPackage.attributes.conditions;
        }

        // find the correct rule_component that goes with this type
        items && items.every(function (item) {

          // if it is the same delegate descriptor
          if (item.id === ruleComponent.attributes.delegate_descriptor_id) {

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
            ruleComponentPath
          );
        }
          
      });

    }

    promises.push(promise);

  }

  return Promise.all(promises)
  .then(() => {
    spinner.stop();
  })
  .catch((e) => {
    console.error(e);
    spinner.stop();
  });

};