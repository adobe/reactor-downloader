#!/usr/bin/env node

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
const yargs = require('yargs');
const inquirer = require('inquirer');
const Reactor = require('@adobe/reactor-sdk').default;
const getAccessToken = require('./getAccessToken');
const download = require('./download');

yargs
.usage('Usage: $0 [options]')
// options
.options({
  env: {
    type: 'string',
    describe: 'The environment where the property resides.',
    choices: ['development', 'qe', 'integration', 'production']
  },
  'private-key': {
    type: 'string',
    describe: 'For authentication using an Adobe I/O integration. The local path (relative or absolute) to the RSA private key. Instructions on how to generate this key can be found in the Getting Started guide (https://developer.adobelaunch.com/guides/extensions/getting-started/) and should have been used when creating your integration through the Adobe I/O console. Optionally, rather than passing the private key path as a command line argument, it can instead be provided by setting one of the following environment variables, depending on the environment that will be receiving the extension package: REACTOR_UPLOADER_PRIVATE_KEY_DEVELOPMENT, REACTOR_UPLOADER_PRIVATE_KEY_QE, REACTOR_UPLOADER_PRIVATE_KEY_INTEGRATION, REACTOR_UPLOADER_PRIVATE_KEY_PRODUCTION'
  },
  'org-id': {
    type: 'string',
    describe: 'For authentication using an Adobe I/O integration. Your organization ID. You can find this on the overview screen for the integration you have created within the Adobe I/O console (https://console.adobe.io).'
  },
  'tech-account-id': {
    type: 'string',
    describe: 'For authentication using an Adobe I/O integration. Your technical account ID. You can find this on the overview screen for the integration you have created within the Adobe I/O console (https://console.adobe.io).'
  },
  'api-key': {
    type: 'string',
    describe: 'For authentication using an Adobe I/O integration. Your API key (client ID). You can find this on the overview screen for the integration you have created within the Adobe I/O console (https://console.adobe.io).'
  },
  'client-secret': {
    type: 'string',
    describe: 'For authentication using an Adobe I/O integration. Your client secret. You can find this on the overview screen for the integration you have created within the Adobe I/O console (https://console.adobe.io). Optionally, rather than passing the client secret as a command line argument, it can instead be provided by setting one of the following environment variables, depending on the environment that will be receiving the extension package: REACTOR_UPLOADER_CLIENT_SECRET_DEVELOPMENT, REACTOR_UPLOADER_CLIENT_SECRET_QE, REACTOR_UPLOADER_CLIENT_SECRET_INTEGRATION, REACTOR_UPLOADER_CLIENT_SECRET_PRODUCTION'
  },
  'property-id': {
    type: 'string',
    describe: 'The Launch Property you want to bootstrap your repo with.'
  },
  'save': {
    type: 'boolean',
    describe: 'Whether to save the authentication and other settings in a file for further use in other tools.'
  },
  'settings-path': {
    type: 'string',
    describe: 'The location to save the settings.  The file name should end in ".json".  (defaults to ./reactor-settings.json)'
  }
})
// (default)
.command('$0', 'Download an Adobe Launch property to your local file system.', async (argv) => {

  let args = argv.argv;
  let settingsPath = args.settingsPath || './.reactor-settings.json';

  // if the file exists, use that instead
  if (fs.existsSync(settingsPath)) {

    try {
      args = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

      // set this so it doesn't trigger
      args.env = args.environment.name;
      args.privateKey = args.integration && args.integration.privateKey;
      args.orgId = args.integration && args.integration.payload && args.integration.payload.iss;
      args.techAccountId = args.integration && args.integration.payload && args.integration.payload.sub;
      args.apiKey = args.integration && args.integration.clientId;
      args.clientSecret = args.integration && args.integration.clientSecret;
      args.clientSecret = args.integration && args.integration.clientSecret;
    } catch (e) {
      throw Error('Settings file is not parsable as a JSON object.');
    }
  }

  // get the environment
  if (!args.env) {
    args.env = (await inquirer.prompt([{
      type: 'list',
      name: 'env',
      message: 'To which environment would you like to download the property from?',
      choices: [{
        name: 'Production',
        value: 'production',
      }, {
        name: 'Integration (Adobe Internal Use Only)',
        value: 'integration',
      }, {
        name: 'QE (Adobe Internal Use Only)',
        value: 'qe',
      }, {
        name: 'Development (Adobe Internal Use Only)',
        value: 'development',
      }],
      default: 0
    }])).env;
  }
  const environments = {
    production: {
      name: 'production',
      ims: 'https://ims-na1.adobelogin.com',
      jwt: 'https://ims-na1.adobelogin.com/ims/exchange/jwt',
      aud: 'https://ims-na1.adobelogin.com/c/',
      scope: 'https://ims-na1.adobelogin.com/s/',
      reactorUrl: 'https://reactor.adobe.io',
    },
    integration: {
      name: 'integration',
      ims: 'https://ims-na1.adobelogin.com',
      jwt: 'https://ims-na1.adobelogin.com/ims/exchange/jwt',
      aud: 'https://ims-na1.adobelogin.com/c/',
      scope: 'https://ims-na1.adobelogin.com/s/',
      reactorUrl: 'https://reactor-integration.adobe.io',
    },
    qe: {
      name: 'qe',
      ims: 'https://ims-na1-stg1.adobelogin.com',
      jwt: 'https://ims-na1-stg1.adobelogin.com/ims/exchange/jwt',
      aud: 'https://ims-na1-stg1.adobelogin.com/c/',
      scope: 'https://ims-na1-stg1.adobelogin.com/s/',
      reactorUrl: 'https://reactor-qe.adobe.io',
    },
    development: {
      name: 'development',
      ims: 'https://ims-na1-stg1.adobelogin.com',
      jwt: 'https://ims-na1-stg1.adobelogin.com/ims/exchange/jwt',
      aud: 'https://ims-na1-stg1.adobelogin.com/c/',
      scope: 'https://ims-na1-stg1.adobelogin.com/s/',
      reactorUrl: 'https://reactor-dev.adobe.io',
    }
  };

  args.environment = environments[args.env];

  // accessToken information
  if (!args.privateKey) {
    args.privateKey = (await inquirer.prompt([{
      type: 'input',
      name: 'privateKey',
      message: 'What is the path (relative or absolute) to your private key?',
      validate: Boolean
    }])).privateKey;
  }

  if (!args.orgId) {
    args.orgId = (await inquirer.prompt([{
      type: 'input',
      name: 'orgId',
      message: 'What is your organization ID?',
      validate: Boolean
    }])).orgId;
  }

  if (!args.techAccountId) {
    args.techAccountId = (await inquirer.prompt([{
      type: 'input',
      name: 'techAccountId',
      message: 'What is your technical account ID?',
      validate: Boolean
    }])).techAccountId;
  }

  if (!args.apiKey) {
    args.apiKey = (await inquirer.prompt([{
      type: 'input',
      name: 'apiKey',
      message: 'What is your API key (client ID)?',
      validate: Boolean
    }])).apiKey;
  }

  if (!args.clientSecret) {
    args.clientSecret = (await inquirer.prompt([{
      type: 'input',
      name: 'clientSecret',
      message: 'What is your client secret?',
      validate: Boolean
    }])).clientSecret;
  }

  // if we were passed a payload already, us that for authenticating...
  if (args.integration) {

    // getAccessToken
    args.accessToken = await getAccessToken(args);
    
  // otherwise try the admin metascope...
  // TODO: add other metascopes...
  } else {
    const METASCOPES = [
      // 'ent_reactor_extension_developer_sdk',
      // 'ent_reactor_admin_sdk',
      // 'ent_reactor_it_admin_sdk',
      'ent_reactor_sdk',
    ];
    // try to get an access token using a few different metascopes
    for (let i = 0; i < METASCOPES.length; i++) {

      try {

        // getAccessToken
        args.accessToken = await getAccessToken({
          environment: args.environment,
          integration: {
            techAccountId: args.techAccountId,
            orgId: args.orgId,
            clientId: args.apiKey,
            clientSecret: args.clientSecret,
            privateKey: args.privateKey,
            payload: {
              iss: args.orgId,
              sub: args.techAccountId,
              aud: args.environment.aud + args.apiKey,
              [`${args.environment.scope}${METASCOPES[i]}`]: true
            }
          }
        });

        // if we don't throw an error, save the integration
        args.integration = {
          techAccountId: args.techAccountId,
          orgId: args.orgId,
          clientId: args.apiKey,
          clientSecret: args.clientSecret,
          privateKey: args.privateKey,
          payload: {
            iss: args.orgId,
            sub: args.techAccountId,
            aud: args.environment.aud + args.apiKey,
            [`${args.environment.scope}${METASCOPES[i]}`]: true
          }
        };

      } catch (e) {

        if (!e.error) {
          throw e;
        }

        const parsedErrorObject = JSON.parse(e.error);

        if (
          parsedErrorObject.error !== 'invalid_scope' || 
          i === METASCOPES.length - 1
        ) {
          throw new Error(`Error retrieving access token. ${parsedErrorObject.error_description}`);
        }

      }

    }
  }
  

  // propertyId
  if (!args.propertyId) {

    let properties = [];

    const reactor = await new Reactor(args.accessToken, {
      reactorUrl: args.environment.reactorUrl
    });

    const companies = await reactor.listCompanies();

    // loop through companies
    for (const company of companies.data) {
      const tempProperties = await reactor.listPropertiesForCompany(company.id);
      // set reference back because that is what I want to use
      for (const tempProperty of tempProperties.data) {
        tempProperty.relationships.company = company;
        properties.push(tempProperty);
      }
    }

    args.propertyId = (await inquirer.prompt([{
      type: 'list',
      name: 'propertyId',
      message: 'What is the property id that you would like to bootstrap this repository with?',
      choices: properties.map(
        (property) => ({
          name: 
            property.relationships.company.attributes.name + 
            '/' + property.attributes.name,
          value: property.id,
        })
      ),
      validate: Boolean
    }])).propertyId;
  }

  await download(args);

  if (args.save) {

    // settings object
    const settings = {
      propertyId: args.propertyId,
      environment: args.environment,
      integration: {
        clientId: args.integration.clientId,
        clientSecret: args.integration.clientSecret,
        privateKey: args.integration.privateKey,
        payload: args.integration.payload,
      },
    };

    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, '  '));

  }
  
})
// TODO: finish this when ready and public
// .epilogue('For more information, see https://www.npmjs.com/package/@adobe/reactor-sync.')
.help('h')
.alias('h', 'help')
.argv;





















