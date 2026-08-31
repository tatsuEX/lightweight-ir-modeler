import { isPlainObject } from '$lib/projection/clone-component';
import type { IrProjectionPlugin, IrProjectionView } from '$lib/projection/types';

/** 射影プラグイン id */
export const DB_MAXLENGTH_PLUGIN_ID = 'db-maxlength';

/** UTF-8 / Oracle VARCHAR2 BYTE の典型倍率 */
export const DEFAULT_DB_BYTES_PER_CHAR = 3;

/**
 * pluginOptions.bytesPerChar を正の整数として読む
 */
function readBytesPerChar(options: Record<string, unknown> | undefined): number {
	if (options === undefined || options.bytesPerChar === undefined) {
		return DEFAULT_DB_BYTES_PER_CHAR;
	}

	const value = options.bytesPerChar;
	if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
		throw new Error('db-maxlength bytesPerChar must be a positive integer');
	}

	return value;
}

/**
 * validation.maxlength（文字数）があるときだけ dbMaxlength を足す
 */
function projectComponent(component: unknown, bytesPerChar: number): unknown {
	if (!isPlainObject(component)) {
		return component;
	}

	const validation = component.validation;
	if (!isPlainObject(validation)) {
		return component;
	}

	const maxlength = validation.maxlength;
	if (typeof maxlength !== 'number' || !Number.isFinite(maxlength) || maxlength < 0) {
		return component;
	}

	return {
		...component,
		validation: {
			...validation,
			dbMaxlength: Math.trunc(maxlength * bytesPerChar)
		}
	};
}

/**
 * IR の文字数 maxlength から DB カラム長を非破壊で追加する
 */
export const dbMaxlengthPlugin: IrProjectionPlugin = {
	id: DB_MAXLENGTH_PLUGIN_ID,
	kind: 'transform',
	/**
	 * maxlength がある component に validation.dbMaxlength を足す
	 */
	project(
		view: IrProjectionView,
		options: Record<string, unknown> | undefined
	): IrProjectionView {
		const bytesPerChar = readBytesPerChar(options);
		return {
			...view,
			components: view.components.map((component) => projectComponent(component, bytesPerChar))
		};
	}
};
