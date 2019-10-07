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

var
  fs = require('fs');

module.exports = function (transforms, settings, path) {
  var 
    get;

  // transform it into files
  if (transforms) {

    // get
    get = function (path, obj) {
      var
        parts,
        part,
        value = '',
        i, il;

      // break into parts
      parts = path.split('.');

      // loop through parts
      for (i = 0, il = parts.length; i < il; i++) {
        part = parts[i];

        // if that path exists
        if (obj[part]) {
          
          // if it is the last part
          if (i === il - 1) {
            value = obj[part];
          // otherwise drop down
          } else {
            obj = obj[part];
          }
          
        } else {
          break;
        }
      }

      return value;
    };

    // loop through each of the transforms and make the transform
    transforms.forEach(function (transform) {
      var
        value;

      // get the value
      value = get(transform.propertyPath, settings);

      // if we didn't get anything back
      if (!value) {
        return;
      }
      
      // function 
      if (transform.type === 'function') {

        value = `//==== START TRANSFORM CODE - DO NOT REMOVE ====
function (${transform.parameters ? transform.parameters.join(', ') : ''}) {
//==== END TRANSFORM CODE ====
${value}
//==== START TRANSFORM CODE - DO NOT REMOVE ====
}
//==== END TRANSFORM CODE ====`;

        // write the settings file.
        fs.writeFileSync(
          `${path}/settings.${transform.propertyPath}.js`,
          value
        );

      // file or customCode
      } else if (
        transform.type === 'file' ||
        transform.type === 'customCode'
      ) {

        // write the settings file.
        fs.writeFileSync(
          `${path}/settings.${transform.propertyPath}.js`,
          value
        );

      } else {
        console.error('unrecognized transform');
        console.log(transform);
      }

    });

  }

};