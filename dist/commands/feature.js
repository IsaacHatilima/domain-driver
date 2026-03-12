"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeFeature = makeFeature;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const FEATURE_DIRS = [
    'components/server',
    'components/client',
    'containers',
    'hooks',
    'services',
    'repositories',
    'schemas',
];
function renderTemplate(name) {
    const componentName = name
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
    return `export default function ${componentName}Page() {
  return (
    <div>
      <h1>${componentName}</h1>
    </div>
  );
}
`;
}
async function makeFeature(name) {
    const base = path.join(process.cwd(), 'app', name);
    for (const dir of FEATURE_DIRS) {
        fs.mkdirSync(path.join(base, dir), { recursive: true });
        fs.writeFileSync(path.join(base, dir, '.gitkeep'), '');
    }
    const page = renderTemplate(name);
    fs.writeFileSync(path.join(base, 'page.tsx'), page);
    console.log(`✅ Feature "${name}" scaffolded at ${base}`);
}
