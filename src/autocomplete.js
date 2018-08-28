const acorn = require('acorn');

const FormatterWorker = function() {};

FormatterWorker.ESTreeWalker = class {
  /**
     * @param {function(!ESTree.Node):(!Object|undefined)} beforeVisit
     * @param {function(!ESTree.Node)=} afterVisit
     */
  constructor(beforeVisit, afterVisit) {
    this._beforeVisit = beforeVisit;
    this._afterVisit = afterVisit || new Function();
    this._walkNulls = false;
  }

  /**
     * @param {boolean} value
     */
  setWalkNulls(value) {
    this._walkNulls = value;
  }

  /**
     * @param {!ESTree.Node} ast
     */
  walk(ast) {
    this._innerWalk(ast, null);
  }

  /**
     * @param {!ESTree.Node} node
     * @param {?ESTree.Node} parent
     */
  _innerWalk(node, parent) {
    if (!node && parent && this._walkNulls) {
      const result = /** @type {!Object} */ ({ raw: 'null', value: null });
      result.type = 'Literal';
      node = /** @type {!ESTree.Node} */ (result);
    }

    if (!node) {
      return;
    }
    node.parent = parent;

    if (this._beforeVisit.call(null, node) === FormatterWorker.ESTreeWalker.SkipSubtree) {
      this._afterVisit.call(null, node);
      return;
    }

    const walkOrder = FormatterWorker.ESTreeWalker._walkOrder[node.type];
    if (!walkOrder) {
      console.error(`Walk order not defined for ${node.type}`);
      return;
    }

    if (node.type === 'TemplateLiteral') {
      const templateLiteral = /** @type {!ESTree.TemplateLiteralNode} */ (node);
      const expressionsLength = templateLiteral.expressions.length;
      for (let i = 0; i < expressionsLength; ++i) {
        this._innerWalk(templateLiteral.quasis[i], templateLiteral);
        this._innerWalk(templateLiteral.expressions[i], templateLiteral);
      }
      this._innerWalk(templateLiteral.quasis[expressionsLength], templateLiteral);
    } else {
      for (let i = 0; i < walkOrder.length; ++i) {
        const entity = node[walkOrder[i]];
        if (Array.isArray(entity)) {
          this._walkArray(entity, node);
        } else {
          this._innerWalk(entity, node);
        }
      }
    }

    this._afterVisit.call(null, node);
  }

  /**
     * @param {!Array.<!ESTree.Node>} nodeArray
     * @param {?ESTree.Node} parentNode
     */
  _walkArray(nodeArray, parentNode) {
    for (let i = 0; i < nodeArray.length; ++i) {
      this._innerWalk(nodeArray[i], parentNode);
    }
  }
};

/** @typedef {!Object} FormatterWorker.ESTreeWalker.SkipSubtree */
FormatterWorker.ESTreeWalker.SkipSubtree = {};

/** @enum {!Array.<string>} */
FormatterWorker.ESTreeWalker._walkOrder = {
  AwaitExpression: ['arguments'],
  ArrayExpression: ['elements'],
  ArrayPattern: ['elements'],
  ArrowFunctionExpression: ['params', 'body'],
  AssignmentExpression: ['left', 'right'],
  BinaryExpression: ['left', 'right'],
  BlockStatement: ['body'],
  BreakStatement: ['label'],
  CallExpression: ['callee', 'arguments'],
  CatchClause: ['param', 'body'],
  ClassBody: ['body'],
  ClassDeclaration: ['id', 'superClass', 'body'],
  ClassExpression: ['id', 'superClass', 'body'],
  ConditionalExpression: ['test', 'consequent', 'alternate'],
  ContinueStatement: ['label'],
  DebuggerStatement: [],
  DoWhileStatement: ['body', 'test'],
  EmptyStatement: [],
  ExpressionStatement: ['expression'],
  ForInStatement: ['left', 'right', 'body'],
  ForOfStatement: ['left', 'right', 'body'],
  ForStatement: ['init', 'test', 'update', 'body'],
  FunctionDeclaration: ['id', 'params', 'body'],
  FunctionExpression: ['id', 'params', 'body'],
  Identifier: [],
  IfStatement: ['test', 'consequent', 'alternate'],
  LabeledStatement: ['label', 'body'],
  Literal: [],
  LogicalExpression: ['left', 'right'],
  MemberExpression: ['object', 'property'],
  MethodDefinition: ['key', 'value'],
  NewExpression: ['callee', 'arguments'],
  ObjectExpression: ['properties'],
  ObjectPattern: ['properties'],
  ParenthesizedExpression: ['expression'],
  Program: ['body'],
  Property: ['key', 'value'],
  ReturnStatement: ['argument'],
  SequenceExpression: ['expressions'],
  Super: [],
  SwitchCase: ['test', 'consequent'],
  SwitchStatement: ['discriminant', 'cases'],
  TaggedTemplateExpression: ['tag', 'quasi'],
  TemplateElement: [],
  TemplateLiteral: ['quasis', 'expressions'],
  ThisExpression: [],
  ThrowStatement: ['argument'],
  TryStatement: ['block', 'handler', 'finalizer'],
  UnaryExpression: ['argument'],
  UpdateExpression: ['argument'],
  VariableDeclaration: ['declarations'],
  VariableDeclarator: ['id', 'init'],
  WhileStatement: ['test', 'body'],
  WithStatement: ['object', 'body'],
  YieldExpression: ['argument'],
};

FormatterWorker.findLastExpression = function (content) {
  if (content.length > 10000) {
    return null;
  }
  try {
    const tokenizer = acorn.tokenizer(content, { ecmaVersion: 9 });
    while (tokenizer.getToken().type !== acorn.tokTypes.eof) {
    }
  } catch (e) {
    return null;
  }

  const suffix = '.DEVTOOLS';
  try {
    acorn.parse(content + suffix, { ecmaVersion: 9 });
  } catch (parseError) {
    // If this is an invalid location for a '.', don't attempt to give autocomplete
    if (parseError.message.startsWith('Unexpected token') && parseError.pos === content.length) {
      return null;
    }
  }
  const base = FormatterWorker._lastCompleteExpression(content, suffix, new Set(['MemberExpression', 'Identifier']));
  if (!base) {
    return null;
  }
  const { baseExpression, baseNode } = base;
  const possibleSideEffects = '';
  return { baseExpression, baseNode };
};


FormatterWorker._lastCompleteExpression = function (content, suffix, types) {
  /** @type {!ESTree.Node} */
  let ast;
  let parsedContent = '';
  for (let i = 0; i < content.length; i++) {
    try {
      // Wrap content in paren to successfully parse object literals
      parsedContent = content[i] === '{' ? `(${content.substring(i)})${suffix}` : `${content.substring(i)}${suffix}`;
      ast = acorn.parse(parsedContent, { ecmaVersion: 9 });
      break;
    } catch (e) {
        // console.log(e)
    }
  }
  if (!ast) {
    return null;
  }
  let baseNode = null;
  const walker = new FormatterWorker.ESTreeWalker((node) => {
    if (baseNode || node.end < ast.end) {
      return FormatterWorker.ESTreeWalker.SkipSubtree;
    }
    if (types.has(node.type)) {
      baseNode = node;
    }
  });
  walker.walk(ast);
  if (!baseNode) {
    return null;
  }
  let baseExpression = parsedContent.substring(baseNode.start, parsedContent.length - suffix.length);
  if (baseExpression.startsWith('{')) {
    baseExpression = `(${baseExpression})`;
  }
  return { baseNode, baseExpression };
};


module.exports = FormatterWorker;