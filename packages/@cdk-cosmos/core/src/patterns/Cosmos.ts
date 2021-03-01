import { Construct, Stack } from '@aws-cdk/core';
import { Component } from '../core';
import { NetworkBuilderFeature, NetworkBuilderProps } from '../features/network-builder';

export interface ICosmos {}
export interface CosmosProps extends NetworkBuilderProps {}

export const Cosmo = (scope: Construct, id: string, props: CosmosProps) => {
  return new Component(scope, id, props, Stack).construct(NetworkBuilderFeature);
};

const cos = Cosmo({} as any, '', {
  cidr: '',
});
const t: Component = cos;

if (t.hasFeature(NetworkBuilderFeature)) {
  console.log(t.resources.networkBuilder);
}
