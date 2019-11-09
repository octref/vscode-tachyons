"use strict";

import * as vscode from "vscode";
import {
  DefinitionProvider,
  Uri,
  TextDocument,
  Position,
  CancellationToken,
  Range,
  Location,
  Definition
} from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as postcss from "postcss";
import * as _ from "lodash";

export function activate(context: vscode.ExtensionContext) {
  const rootPath = vscode.workspace.rootPath;
  let tachyonsPath = path.join(
    rootPath,
    "node_modules/tachyons/css/tachyons.css"
  );

  fs.stat(tachyonsPath, err => {
    if (err) {
      tachyonsPath = context.asAbsolutePath("tachyons.css");
    }

    const provider = new TachyonsDefinitionProvider(tachyonsPath);

    vscode.languages.registerDefinitionProvider(
      ["html", "javascript", "svelte"],
      provider
    );
  });
}

class TachyonsDefinitionProvider implements DefinitionProvider {
  private _tachyonsUri: Uri;
  private _definitionMap: Map<string, Definition>;

  constructor(tachyonsPath: string) {
    this._tachyonsUri = Uri.file(tachyonsPath);
    this.generateDefinitionMap();
  }

  private generateDefinitionMap(): void {
    this._definitionMap = new Map();

    const tachyonsSource = fs.readFileSync(this._tachyonsUri.fsPath, "utf-8");
    postcss()
      .process(tachyonsSource)
      .then(result => {
        result.root.walkRules(rule => {
          const { selectors, source } = rule;

          selectors.forEach(selector => {
            if (this.isClassSelector(selector)) {
              this._definitionMap.set(selector, this.getDefinition(source));
            }
          });
        });
      });
  }

  private getDefinition(source: postcss.NodeSource): Definition {
    const start = new Position(source.start.line - 1, source.start.column);
    const end = new Position(source.end.line - 1, source.end.column);

    return new Location(this._tachyonsUri, new Range(start, end));
  }

  provideDefinition(
    document: TextDocument,
    position: Position,
    token: CancellationToken
  ): Definition {
    const currWordRange = document.getWordRangeAtPosition(position);

    // Ensure the current word is valid
    if (!currWordRange) {
      return;
    }

    const currWord = document.getText(currWordRange);

    const classAtPosition =
      "." +
      this.getClassAtPosition(document, position, currWordRange, currWord);
    if (this._definitionMap.has(classAtPosition)) {
      return this._definitionMap.get(classAtPosition);
    }
  }

  private isClassSelector(selector: string) {
    return selector[0] === ".";
  }

  private getClassAtPosition(
    document: TextDocument,
    position: Position,
    currWordRange: Range,
    currWord: string
  ): string {
    const classes = _.trim(currWord, `"'`).split(" ");
    const positionOffset = position.character - currWordRange.start.character;
    let startOffset = 0;
    return classes.find(c => {
      startOffset += 1 + c.length;
      return positionOffset <= startOffset;
    });
  }
}
