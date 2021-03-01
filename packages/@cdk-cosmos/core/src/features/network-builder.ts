import { createFeature, IComponent } from '../core';

import { NetworkBuilder } from '@aws-cdk/aws-ec2/lib/network-util';

export interface INetworkBuilder {
  networkBuilder: NetworkBuilder;
}
export interface NetworkBuilderProps {
  cidr: string;
}

export const NetworkBuilderFeature = createFeature({
  name: 'NetworkBuilder',
  construct(scope: IComponent, props: NetworkBuilderProps): INetworkBuilder {
    return {
      networkBuilder: new NetworkBuilder(props.cidr),
    };
  },
});
