import './App.css'
import React from 'react'
import { merge, isPlainObject } from 'lodash'

const callbackSymbol = Symbol('CallbackSymbol')
const isProxySymbol = Symbol('IsProxy')

// Test object we'll turn into a react render tree of inputs
const testObj = {
  input1: 'input1',
  input2: '',
  input3: '',
  complexInput: {
    cInput1: 'cInput1',
    cInput2: '',
  },
}

// Factory creating handlers with a set trap
// set trap functionality:
// If Symbol('CallbackSymbol') is being set, assign that function to the
// `callbacks` object under the provided target prop. Then return.
// Otherwise set the value on the prop
// If a callback for the prop exists, call it
function getProxyHandler() {
  return {
    callbacks: {},
    set: function (target, prop, value) {
      if (prop === callbackSymbol) {
        const [targetProp, callback] = value
        console.log(`setting callback for ${targetProp}`)
        if (!this.callbacks[targetProp]) {
          this.callbacks[targetProp] = new Set()
        }
        this.callbacks[targetProp].add(callback)
        return true
      }

      if (isPlainObject(value) && !value[isProxySymbol]) {
        target[prop] = proxifyObject(value, getProxyHandler)
        return true
      }

      target[prop] = value

      if (this.callbacks[prop]) {
        console.log(`firing callbacks for ${prop}`)
        this.callbacks[prop].forEach((cb) => cb(value))
      } else {
        console.log(`no callback found for ${prop}`)
      }

      return true
    },
    get: function (target, prop, receiver) {
      if (prop === isProxySymbol) {
        return true
      }

      return Reflect.get(...arguments)
    },
  }
}

// Recursively wrap all objects in a proxy with our handler
function proxifyObject(obj, getHandler) {
  const handler = getHandler()
  // Do we need to handle objects within arrays?
  const keysOfNestedObjects = Object.keys(obj).filter((key) =>
    isPlainObject(obj[key])
  )

  keysOfNestedObjects.forEach(
    (key) => (obj[key] = proxifyObject(obj[key], getHandler))
  )

  return new Proxy(obj, handler)
}
const proxiedTestObj = proxifyObject(testObj, getProxyHandler)

const ProxyUpdateWrapper = ({
  proxyObj,
  targetProp,
  children,
  ...restProps
}) => {
  const [value, setValue] = React.useState(proxyObj[targetProp])
  React.useEffect(() => {
    // This will be set as a callback on the proxy's handler
    // proxyObj[targetProp] = setValue
    proxyObj[callbackSymbol] = [targetProp, setValue]
  }, [proxyObj, targetProp])

  return children({ value, ...restProps })
}

const FormGenerator = ({ proxyObj }) => {
  return Object.keys(proxyObj).map((key) => {
    if (isPlainObject(proxyObj[key])) {
      return <FormGenerator key={key} proxyObj={proxyObj[key]} />
    }

    return (
      <ProxyUpdateWrapper key={key} proxyObj={proxyObj} targetProp={key}>
        {({ value }) => {
          const handleChange = (e) => (proxyObj[key] = e.currentTarget.value)
          return <input value={value} onChange={handleChange} />
        }}
      </ProxyUpdateWrapper>
    )
  })
}

const JsonEditor = () => {
  const [readOnlyJson, setReadOnlyJson] = React.useState(
    JSON.stringify(proxiedTestObj, undefined, 2)
  )
  const [editableJson, setEditableJson] = React.useState(
    JSON.stringify(proxiedTestObj, undefined, 2)
  )

  return (
    <>
      <textarea
        style={{ width: '300px', height: '300px' }}
        defaultValue={editableJson}
        onChange={(e) => {
          setEditableJson(e.currentTarget.value)
        }}
      />
      <textarea
        style={{ width: '300px', height: '300px' }}
        value={readOnlyJson}
        readOnly
      />
      <button
        onClick={() => {
          merge(proxiedTestObj, JSON.parse(editableJson))
          setReadOnlyJson(editableJson)
        }}
      >
        merge
      </button>
    </>
  )
}

const updateInput2WithReverseValue = (value) => {
  proxiedTestObj.input2 = [...value].reverse().join('')
}

function App() {
  proxiedTestObj[callbackSymbol] = ['input1', updateInput2WithReverseValue]

  return (
    <>
      <span>test</span>
      <FormGenerator proxyObj={proxiedTestObj} listeners={[]} />
      <br />
      <br />
      <br />
      <JsonEditor />
    </>
  )
}

export default App
