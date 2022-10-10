const _isEmpty = (val) => {
    return val === undefined && val === null && val.trim() === '' ? true : false
}

/**
 * 
 * @param {object} __data_format // structure of data for response
 * @param {object} __source // data source from database
 * @returns // data to return based on the __data_format
 */
const builder = (__data_format = event_data, __source = SAMPLE_EVENTS_ARRAY) => {
    var response_data = undefined

    function checkifObject(__format) {
        return (typeof __format === 'object') ? (Array.isArray(__format)) ? 'array' : 'object' : null
    }

    function checkCriteria(__criterias, __source_item_data) {
        const criteria = Object.keys(__criterias)
        var __data_object = {}
// logger('criteria',criteria)

        // Check if the source data and output data is in array
        if (criteria.indexOf('array_source') !== -1 && criteria.indexOf('content') !== -1) {
// logger('>>> __criterias:', __criterias)
            let array_source = __criterias.array_source
            let content_criterias = [__criterias.content] // enclosed in array, for multiple entry compiling
// logger('__source_item_data', __source_item_data)
// logger('has content:', content_criterias)
// logger('has array_source: ', array_source)
// logger('array_source data:', __source_item_data[array_source])

            let __new_data = compile(content_criterias, __source_item_data[array_source]);
// logger('__new_data', __new_data)
            return __new_data
            // don't proceed below;
        }

        criteria.forEach((__field, __index) => {
            let criterion = __criterias[__field]
// logger('__source_item_data', __source_item_data)
// logger('criterion', criterion)
            // check if required object or array
            let criterion_data_type = checkifObject(criterion)
// logger('criterion_data_type', criterion_data_type)
            if (['array', 'object'].indexOf(criterion_data_type) !== -1) {
                switch(criterion_data_type) {
                    // for array format data on criterion __field
                    case 'array':
                        __data_object = {
                            ...__data_object,
                            [__field]: [
                                ...__data_object[__field] || [],
                                ...checkCriteria(criterion[0], __source_item_data)
                            ]
                        }
                        break;

                    // for object format data on criterion __field
                    case 'object':
                        __data_object = {
                            ...__data_object,
                            [__field]: {
                                ...__data_object[__field] || {},
                                ...checkCriteria(criterion, __source_item_data)
                            }
                        }
                        break;

                    default:
                }

                return // terminate or skip criterion loop to next iteration
            }

            // check if default text/number
            let default_value = criterion.split(':')
            if (default_value.length > 1) {
                var _value = 'na'
                switch(default_value[0]) {
                    case 'text': 
                        _value = default_value[1]
                        break
                    
                    case 'bool': 
                        _value = default_value[1] == 'true' ? true : false
                        break

                    case 'pip': // piping 2 values when first value is null, undefined or empty
                        // i.e: pip:google_event_id|event_id
                        let or_fields = default_value[1].split("|")
                        _value = (or_fields.length > 1)
                            ? _isEmpty(or_fields[0]) ? __source_item_data[or_fields[0]] : __source_item_data[or_fields[1]]
                            : 'incorrect pipe values'
                        break
                    
                    case 'concat': // concatinates
                        // i.e.: concat:first_name[+]last_name
                        let _concat_value = ''
                        default_value[1].split("+").forEach(_field => {
                            let _field_data = __source_item_data
                            _field.split(".").forEach(_concat_field => { _field_data = _field_data[_concat_field] })

                            _concat_value += _field_data
                        })
                        _value = _concat_value //`${__source_item_data[concat_fields[0]]}${__source_item_data[concat_fields[1]]}`
                        break
                    
                    case 'cond': // conditional
                        // i.e.: cond:appointment.meeting_type_id?1=phone,2=grapl
                        let _condition = default_value[1].split("?")
                        let _statement = __source_item_data 
                        _condition[0].split(".").forEach(_condition_field => { _statement = _statement[_condition_field] })
                        let _blocks = _condition[1].split(",")
                        let _then_expression = {
                            value: _blocks[0].split("=")[0],
                            result: _blocks[0].split("=")[1]
                        }

                        let _else_expression = {
                            value: _blocks[1].split("=")[0],
                            result: _blocks[1].split("=")[1]
                        }

                        _value = (_statement == _then_expression.value) ? _then_expression.result : _else_expression.result
                        break
                }

                __data_object = {
                        ...__data_object,
                        [__field]: _value
                    }                           
                
                return
            }

            // check if criterion is an object with . pointer
            let __obj_criterion = criterion.split('.')
// logger('__field', __field)
// logger('__obj_criterion', __obj_criterion)
            // find the the (array_source=__obj_criterion[0]) from `__source_item_data` and named as `__array_source`
            if (__obj_criterion.length > 1) {
                // check first criterion field if has array indicator
// logger('__obj_criterion[0]', __obj_criterion[0])
                if (__obj_criterion[0].indexOf("[]") !== -1) {
                    /**
                     * // TODO: SHOULD BE REMOVING THIS SECTION
                     */
                    let spliced_crit_field = __obj_criterion[0].split('')
                    spliced_crit_field.splice((spliced_crit_field.length -2), spliced_crit_field.length)
                    spliced_crit_field = spliced_crit_field.join('')
// logger('spliced_crit_field', spliced_crit_field)

// logger('__source_item_data[__obj_criterion[0]]', __obj_criterion[0], spliced_crit_field, __source_item_data[spliced_crit_field])
                    // source item data with current field is an array
                    __source_item_data[spliced_crit_field].map(__source_item_crit_element => {
                        let __source_item_crit_data = __source_item_crit_element
                        
                        __obj_criterion.forEach((__crit_field, __idx) => {
                            if (__idx > 0) {// skip the array, since it already inside its element
                                __source_item_crit_data = __source_item_crit_data[__crit_field] 
// logger(__crit_field, __source_item_crit_data)
                            }
                        })

                        // insert found data based in criterion/criteria into data object
                        __data_object = {
                            ...__data_object,
                            [__field]: __source_item_crit_data
                        }
                    })
                }
                else {
                    // getting the data from the source based on the nested fields data["field1"]["field2"]["field3"][...][...]
                    let __source_item_crit_data =  __source_item_data
                    
                    __obj_criterion.forEach(__crit_field => {
                        __source_item_crit_data = __source_item_crit_data[__crit_field] 
                    })

                    // insert found data based in criterion/criteria into data object
                    __data_object = {
                        ...__data_object,
                        [__field]: __source_item_crit_data
                    }
                }

                return // terminate or skip criterion loop to next iteration
            }

            // insert found data based in criterion/criteria into data object
            __data_object = {
                ...__data_object,
                [__field]: __source_item_data[criterion]
            }                           
        })

        return __data_object
    }

    const data_type = checkifObject(__data_format)

    if (data_type) {
        switch(data_type) {
            case 'array':
                response_data = []
                
                // getting the criteria
                let arr_criterias = __data_format[0]
                __source.map(__source_item => {
                    response_data = [
                        ...response_data,
                        checkCriteria(arr_criterias, __source_item)
                    ]
                })
                break;

            case 'object':
                response_data = {}
                
                // getting the criteria
                let obj_criterias = __data_format
                __source.map(__source_item => {
                    response_data = {
                        ...response_data,
                        ...checkCriteria(obj_criterias, __source_item)
                    }
                })
                break;
        }
    }

    return response_data
}


module.exports = {
    builder
}