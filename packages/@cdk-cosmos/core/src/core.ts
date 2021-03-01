import { Construct } from '@aws-cdk/core';

type Constructor<T> = new (...args: any[]) => T;

export interface ICreateFeature<Interface = {}, In = IComponent, Props = {}> {
  (component: In, props: Props): Interface;
}

export interface IImportFeature<Interface = {}, In = IComponent, Props = {}> {
  (component: In, props: Props): Interface;
}

export interface IFeature<Interface = {}, In = IComponent, CreateProps = {}, ImportProps = {}> {
  name: string;
  construct?: ICreateFeature<Interface, In, CreateProps>;
  import?: IImportFeature<Interface, In, ImportProps>;
}

export const createFeature: <Interface = {}, In = IComponent, CreateProps = {}, ImportProps = {}>(props: {
  name: string;
  construct?: ICreateFeature<Interface, In, CreateProps>;
  import?: IImportFeature<Interface, In, ImportProps>;
}) => IFeature<Interface, In, CreateProps, ImportProps> = (props) => {
  return {
    name: props.name,
    construct: props.construct,
    import: props.import,
  };
};

export interface IComponent<Interface = {}, Props = {}, Scope extends Construct = Construct> {
  scope: Scope;
  props: Props;
  resources: Interface;
  features: IFeature<any, any>[];

  construct<FInterface = {}, FProps = {}>(
    feature: IFeature<FInterface, this, FProps, any>,
    props?: FProps & Partial<Props>
  ): IComponent<Interface & FInterface, Props & FProps, Scope>;

  import<FInterface = {}, FProps = {}>(
    feature: IFeature<FInterface, this, any, FProps>,
    props?: FProps & Partial<Props>
  ): IComponent<Interface & FInterface, Props & FProps, Scope>;

  hasFeature<FInterface = any>(
    feature: IFeature<FInterface, any, any, any> | string
  ): this is IComponent<FInterface, Props>;
}

export class Component<Interface = {}, Props = {}, Scope extends Construct = Construct>
  implements IComponent<Interface, Props, Scope> {
  scope: Scope;
  props: Props;
  features: IFeature<any, any>[];
  resources: Interface;

  constructor(scope: Construct, id: string, props: Props, type: Constructor<Scope>) {
    this.scope = new type(scope, id, props);
    this.props = props;
    this.features = [];
    this.resources = {} as Interface;
  }

  construct<FInterface = {}, FProps = {}>(
    feature: IFeature<FInterface, this, FProps, any>,
    props?: FProps & Partial<Props>
  ): Component<Interface & FInterface, Props & FProps, Scope> {
    if (!feature.construct) throw new Error('Feature can not be Constructed.');

    Object.assign(this.props, props);
    const resources = feature.construct(this, this.props as any);
    this.features.push(feature as any);
    Object.assign(this.resources, resources);
    return this as any;
  }

  import<FInterface = {}, FProps = {}>(
    feature: IFeature<FInterface, this, any, FProps>,
    props?: FProps & Partial<Props>
  ): Component<Interface & FInterface, Props & FProps, Scope> {
    if (!feature.import) throw new Error('Feature can not be Imported.');

    Object.assign(this.props, props);
    const resources = feature.import(this, this.props as any);
    this.features.push(feature as any);
    Object.assign(this.resources, resources);
    return this as any;
  }

  hasFeature<FInterface = any>(
    feature: IFeature<FInterface, any, any, any> | string
  ): this is Component<FInterface, Props> {
    const featureName = typeof feature === 'object' ? feature.name : feature;
    return this.features.find((x) => x.name === featureName) !== undefined;
  }
}
