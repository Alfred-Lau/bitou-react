// NOTE: 此处想要被引用到，就需要在tsconfig.json中配置 baseUrl
import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols';

const ReactELement = function (type, key, ref, props) {
  const element = {
    $$typeof: REACT_ELEMENT_TYPE,
    key,
    ref,
    props,
    __mark: 'qianzhang',
  };
  return element;
};
